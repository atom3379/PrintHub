# PrintHub

Bilingual Thai/English web-based USB print-server project.

## Current milestone
- React/Vite dashboard with language toggle and upload/preview UI.
- FastAPI API for health, CUPS printer status, uploads, and PDF print submission.
- Backend defaults to localhost only. Do not expose to LAN/internet until authentication and access controls exist.
- Epson L3210 is configured in CUPS as `Epson_L3210` and a CUPS test page printed successfully. PrintHub selects the CUPS default printer, or the first configured printer if no default is set.

## Run
Backend terminal:
```bash
cd ~/PrintHub/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Frontend terminal:
```bash
cd ~/PrintHub/frontend
npm install
npm run dev -- --host 127.0.0.1
```

## Current capabilities and limitations
- PDF files can be previewed and submitted to the selected CUPS printer when a printer is configured.
- Supported office/text files (Word, Excel, PowerPoint, ODT/ODS/ODP, RTF, TXT, Markdown, CSV) can be converted to PDF by LibreOffice for preview and printing.
- Common image files can be uploaded and previewed; image printing is not implemented yet.
- Conversion has a 30-second timeout. Uploads are limited to 50 MB.
- Paper/ink health is shown as unknown unless the printer exposes reliable status data.
- The current recent-files list is browser-session-only; persistent print history, real queue tracking, Discord integration, authentication, and a full document editor are not implemented yet.
- Keep the backend bound to localhost until authentication and access controls exist.