from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

APP_DIR = Path(__file__).resolve().parent
PROJECT_DIR = APP_DIR.parents[1]
UPLOAD_DIR = PROJECT_DIR / "storage" / "uploads"
PREVIEW_DIR = PROJECT_DIR / "storage" / "previews"
JOBS_FILE = PROJECT_DIR / "storage" / "jobs.json"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PREVIEW_DIR.mkdir(parents=True, exist_ok=True)


def load_jobs() -> list[dict[str, Any]]:
    try:
        data = json.loads(JOBS_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def save_jobs(jobs: list[dict[str, Any]]) -> None:
    temporary = JOBS_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(JOBS_FILE)
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
OFFICE_EXTENSIONS = {".doc", ".docx", ".odt", ".rtf", ".txt", ".md", ".xls", ".xlsx", ".ods", ".csv", ".ppt", ".pptx", ".odp"}
ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".odt", ".rtf", ".txt", ".md",
    ".xls", ".xlsx", ".ods", ".csv", ".ppt", ".pptx", ".odp",
    ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff", ".svg", ".heic", ".heif"
}

app = FastAPI(title="PrintHub API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


def run_command(args: list[str], timeout: float = 3.0) -> tuple[int, str]:
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)
        return result.returncode, (result.stdout + result.stderr).strip()
    except FileNotFoundError:
        return 127, f"Required command not found: {args[0]}"
    except subprocess.TimeoutExpired:
        return 124, "Command timed out"


def get_printer_status() -> dict[str, Any]:
    scheduler_code, scheduler_output = run_command(["lpstat", "-r"])
    printer_code, printer_output = run_command(["lpstat", "-p"])
    default_code, default_output = run_command(["lpstat", "-d"])
    printers = []
    if printer_code == 0:
        for line in printer_output.splitlines():
            if line.startswith("printer "):
                parts = line.split()
                if len(parts) >= 2:
                    printers.append({"name": parts[1], "status": "ready" if "is idle" in line.lower() or "enabled" in line.lower() else "attention", "raw": line})
    return {
        "cups_running": scheduler_code == 0 and "scheduler is running" in scheduler_output.lower(),
        "configured": bool(printers),
        "printers": printers,
        "default_printer": default_output.split(":", 1)[1].strip() if default_code == 0 and ":" in default_output else None,
        "paper": {"status": "unknown", "message": "สถานะกระดาษยังตรวจสอบไม่ได้"},
        "ink": {"status": "unknown", "message": "ระดับหมึก/โทนเนอร์ยังตรวจสอบไม่ได้"},
        "details": printer_output or scheduler_output,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "app": "PrintHub API", "version": "0.1.0"}


@app.get("/api/printers")
def printers() -> dict[str, Any]:
    return get_printer_status()


@app.get("/api/jobs")
def jobs() -> dict[str, list[Any]]:
    saved_jobs = load_jobs()
    printable_extensions = {".pdf", *OFFICE_EXTENSIONS, ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff"}
    printer_available = bool(get_printer_status()["configured"])
    for item in saved_jobs:
        extension = str(item.get("extension", Path(str(item.get("name", ""))).suffix)).lower()
        item["can_print_now"] = extension in printable_extensions and printer_available
        if extension == ".svg":
            item["preview_url"] = f"/uploads/{item.get('id')}{extension}"
        elif extension in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff", ".pdf"} or extension in OFFICE_EXTENSIONS:
            item["preview_url"] = f"/api/preview/{item.get('id')}"
    return {"jobs": sorted(saved_jobs, key=lambda item: item.get("created_at", ""), reverse=True)}


def convert_to_pdf(source: Path) -> Path:
    """Convert an uploaded document to a cached PDF using LibreOffice."""
    output = PREVIEW_DIR / f"{source.stem}.pdf"
    if output.is_file() and output.stat().st_size > 0:
        return output
    office = shutil.which("libreoffice") or shutil.which("soffice")
    if not office:
        raise HTTPException(status_code=503, detail="ยังไม่มี LibreOffice สำหรับแปลงไฟล์เอกสาร")
    with tempfile.TemporaryDirectory(prefix="printhub-convert-") as temp_dir:
        profile = Path(temp_dir) / "profile"
        out_dir = Path(temp_dir) / "output"
        out_dir.mkdir()
        command = [office, "--headless", f"-env:UserInstallation={profile.as_uri()}", "--convert-to", "pdf", "--outdir", str(out_dir), str(source)]
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=30, check=False)
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=504, detail="แปลงไฟล์ไม่เสร็จภายใน 30 วินาที")
        converted = out_dir / f"{source.stem}.pdf"
        if result.returncode != 0 or not converted.is_file() or converted.stat().st_size == 0:
            detail = (result.stderr or result.stdout or "LibreOffice แปลงไฟล์ไม่สำเร็จ").strip()[-500:]
            raise HTTPException(status_code=422, detail=detail)
        if converted.read_bytes()[:5] != b"%PDF-":
            raise HTTPException(status_code=422, detail="ไฟล์ที่แปลงได้ไม่ใช่ PDF ที่ถูกต้อง")
        shutil.copyfile(converted, output)
    return output


def convert_image_to_pdf(source: Path) -> Path:
    """Convert a raster image to a cached, printable PDF."""
    output = PREVIEW_DIR / f"{source.stem}.pdf"
    if output.is_file() and output.stat().st_size > 0:
        return output
    try:
        from PIL import Image, ImageOps
        with Image.open(source) as image:
            image.seek(0)  # Use the first frame for animated images such as GIF.
            image = ImageOps.exif_transpose(image)
            if image.mode in {"RGBA", "LA"} or (image.mode == "P" and "transparency" in image.info):
                rgba = image.convert("RGBA")
                background = Image.new("RGB", rgba.size, "white")
                background.paste(rgba, mask=rgba.getchannel("A"))
                image = background
            else:
                image = image.convert("RGB")
            image.save(output, "PDF", resolution=150.0)
    except Exception as exc:
        output.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"เปิดไฟล์รูปภาพไม่ได้: {exc}")
    return output


def find_uploaded_file(file_id: str) -> Path:
    if not re.fullmatch(r"[a-f0-9]{32}", file_id):
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์นี้")
    matches = [path for path in UPLOAD_DIR.iterdir() if path.is_file() and path.stem == file_id]
    if not matches:
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์นี้")
    return matches[0]


@app.get("/api/preview/{file_id}")
def preview_file(file_id: str) -> FileResponse:
    source = find_uploaded_file(file_id)
    if source.suffix.lower() == ".pdf":
        pdf = source
    elif source.suffix.lower() in OFFICE_EXTENSIONS:
        pdf = convert_to_pdf(source)
    elif source.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff"}:
        pdf = convert_image_to_pdf(source)
    else:
        raise HTTPException(status_code=415, detail="ไฟล์ชนิดนี้ยังไม่มีตัวอย่าง PDF")
    return FileResponse(pdf, media_type="application/pdf", filename=f"{source.stem}.pdf", content_disposition_type="inline")


@app.post("/api/uploads")
async def upload_file(file: UploadFile = File(...)) -> dict[str, Any]:
    original_name = Path(file.filename or "upload").name
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="ไฟล์ชนิดนี้ยังไม่รองรับ")
    job_id = uuid.uuid4().hex
    safe_name = f"{job_id}{extension}"
    destination = UPLOAD_DIR / safe_name
    total = 0
    try:
        with destination.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    destination.unlink(missing_ok=True)
                    raise HTTPException(status_code=413, detail="ไฟล์ใหญ่เกิน 50 MB")
                output.write(chunk)
    finally:
        await file.close()
    if total == 0:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="ไม่สามารถอัปโหลดไฟล์ว่างเปล่าได้")
    item = {
        "id": job_id,
        "name": original_name,
        "size": total,
        "extension": extension,
        "preview_url": (f"/uploads/{safe_name}" if extension == ".svg" else f"/api/preview/{job_id}" if extension in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff", ".pdf"} or extension in OFFICE_EXTENSIONS else None),
        "can_print_now": (extension == ".pdf" or extension in OFFICE_EXTENSIONS or extension in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff"}) and bool(get_printer_status()["configured"]),
        "status": "uploaded",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "print_message": None,
    }
    all_jobs = load_jobs()
    all_jobs.append(item)
    save_jobs(all_jobs)
    return item


@app.post("/api/print/{file_id}")
def print_pdf(file_id: str, options: dict[str, Any] | None = Body(default=None)) -> dict[str, Any]:
    options = options or {}
    source = find_uploaded_file(file_id)
    if source.suffix.lower() == ".pdf":
        printable = source
    elif source.suffix.lower() in OFFICE_EXTENSIONS:
        printable = convert_to_pdf(source)
    elif source.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff"}:
        printable = convert_image_to_pdf(source)
    else:
        raise HTTPException(status_code=415, detail="PrintHub ยังพิมพ์ไฟล์ชนิดนี้ไม่ได้")

    # Validate print options before passing them to CUPS.
    pages = str(options.get("pages", "all")).strip()
    if pages.lower() != "all" and not re.fullmatch(r"\d+(?:-\d+)?(?:\s*,\s*\d+(?:-\d+)?)*", pages):
        raise HTTPException(status_code=422, detail="ช่วงหน้าไม่ถูกต้อง เช่น 1-3,5,8-10")
    if pages.lower() != "all":
        for part in pages.split(","):
            bounds = [int(value.strip()) for value in part.split("-")]
            if any(value < 1 for value in bounds) or (len(bounds) == 2 and bounds[0] > bounds[1]):
                raise HTTPException(status_code=422, detail="เลขหน้าต้องเริ่มจาก 1 และช่วงหน้าต้องเรียงจากน้อยไปมาก")

    try:
        copies = int(options.get("copies", 1))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="จำนวนสำเนาต้องเป็นตัวเลข")
    if not 1 <= copies <= 99:
        raise HTTPException(status_code=422, detail="จำนวนสำเนาต้องอยู่ระหว่าง 1 ถึง 99")

    paper_size = str(options.get("paper_size", "A4")).upper()
    if paper_size not in {"A4", "A5", "LETTER", "LEGAL"}:
        raise HTTPException(status_code=422, detail="ขนาดกระดาษไม่รองรับ")
    color_mode = str(options.get("color_mode", "color")).lower()
    if color_mode not in {"color", "monochrome"}:
        raise HTTPException(status_code=422, detail="โหมดสีไม่ถูกต้อง")
    try:
        pages_per_sheet = int(options.get("pages_per_sheet", 1))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="จำนวนหน้าต่อแผ่นไม่ถูกต้อง")
    if pages_per_sheet not in {1, 2, 4, 6, 9, 16}:
        raise HTTPException(status_code=422, detail="รองรับ 1, 2, 4, 6, 9 หรือ 16 หน้าต่อแผ่น")
    orientation = str(options.get("orientation", "portrait")).lower()
    if orientation not in {"portrait", "landscape"}:
        raise HTTPException(status_code=422, detail="แนวกระดาษไม่ถูกต้อง")
    scaling = str(options.get("scaling", "fit")).lower()
    if scaling not in {"fit", "actual"}:
        raise HTTPException(status_code=422, detail="ขนาดการพิมพ์ไม่ถูกต้อง")
    page_border = str(options.get("page_border", "none")).lower()
    if page_border not in {"none", "single", "double"}:
        raise HTTPException(status_code=422, detail="กรอบหน้าไม่ถูกต้อง")

    printer_status = get_printer_status()
    if not printer_status["printers"]:
        raise HTTPException(status_code=409, detail="ยังไม่ได้ตั้งค่าเครื่องพิมพ์ในระบบ")
    printer_name = printer_status.get("default_printer") or printer_status["printers"][0]["name"]
    command = ["lp", "-d", printer_name, "-n", str(copies), "-o", f"media={paper_size}", "-o", f"print-color-mode={color_mode}", "-o", f"number-up={pages_per_sheet}", "-o", f"orientation-requested={3 if orientation == 'portrait' else 4}", "-o", f"page-border={page_border}"]
    if scaling == "fit":
        command.extend(["-o", "fit-to-page"])
    if pages_per_sheet > 1:
        command.extend(["-o", f"number-up-layout={'lrtb' if orientation == 'portrait' else 'tblr'}"])
    if pages.lower() != "all":
        command.extend(["-P", re.sub(r"\s+", "", pages)])
    command.append(str(printable))
    code, output = run_command(command, timeout=10)
    if code != 0:
        raise HTTPException(status_code=502, detail=output or "ส่งงานไปยังเครื่องพิมพ์ไม่สำเร็จ")

    all_jobs = load_jobs()
    for item in all_jobs:
        if item.get("id") == file_id:
            item["status"] = "submitted"
            item["print_message"] = output
            item["printed_at"] = datetime.now(timezone.utc).isoformat()
            item["printer"] = printer_name
            item["print_options"] = {"pages": pages, "copies": copies, "paper_size": paper_size, "color_mode": color_mode, "pages_per_sheet": pages_per_sheet, "orientation": orientation, "scaling": scaling, "page_border": page_border}
            break
    save_jobs(all_jobs)
    return {
        "status": "submitted",
        "message": f"ส่งไฟล์ไปยัง {printer_name} แล้ว",
        "printer": printer_name,
        "print_options": {"pages": pages, "copies": copies, "paper_size": paper_size, "color_mode": color_mode, "pages_per_sheet": pages_per_sheet, "orientation": orientation, "scaling": scaling, "page_border": page_border},
        "cups_response": output,
    }
