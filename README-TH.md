# PrintHub

**English:** [อ่านเอกสารภาษาอังกฤษที่ README.md](README.md)

PrintHub เป็นเว็บแดชบอร์ดสำหรับติดตั้งบนเซิร์ฟเวอร์ของตัวเอง ใช้ดูตัวอย่างเอกสารและส่งงานพิมพ์ไปยังเครื่องพิมพ์ที่ตั้งค่าผ่าน CUPS ส่วนหน้าเว็บพัฒนาด้วย React/Vite และ API ใช้ FastAPI

> **สถานะโปรเจกต์:** ยังอยู่ระหว่างการพัฒนา ควรทดสอบด้วยเอกสารที่ไม่มีข้อมูลสำคัญก่อน ขณะนี้ยังไม่มีระบบยืนยันตัวตนหรือควบคุมสิทธิ์ ห้ามเปิดบริการนี้สู่สาธารณะโดยตรง

## ความสามารถ
- เว็บแดชบอร์ดที่รองรับภาษาไทยและภาษาอังกฤษ
- อัปโหลดและดูตัวอย่างไฟล์ PDF และรูปภาพทั่วไป
- แปลงเอกสารสำนักงานหรือไฟล์ข้อความที่รองรับเป็น PDF ด้วย LibreOffice
- ส่งไฟล์ที่รองรับไปยังเครื่องพิมพ์ที่ตั้งค่าไว้ใน CUPS
- ตั้งค่าการพิมพ์ เช่น จำนวนชุด ช่วงหน้า ขนาดกระดาษ โหมดสี แนวกระดาษ และจำนวนหน้าต่อแผ่น
- บันทึกข้อมูลของงานพิมพ์ไว้ใน storage/jobs.json

## ข้อจำกัดในปัจจุบัน
- เซิร์ฟเวอร์และ backend ออกแบบมาสำหรับ Linux ที่ใช้ CUPS
- ต้องตั้งค่าเครื่องพิมพ์ที่รองรับ CUPS บนเซิร์ฟเวอร์ก่อนจึงจะพิมพ์ได้
- การพิมพ์สองหน้าอัตโนมัติขึ้นอยู่กับเครื่องพิมพ์และไดรเวอร์ หากไม่รองรับต้องพลิกกระดาษเอง
- ยังไม่มีระบบยืนยันตัวตน บัญชีผู้ใช้ การจัดการคิวแบบเรียลไทม์ หรือมาตรการความปลอดภัยสำหรับเปิดให้ใช้งานผ่านอินเทอร์เน็ต
- ไฟล์ที่อัปโหลดและประวัติการพิมพ์ถูกเก็บไว้บนเซิร์ฟเวอร์ อย่าอัปโหลดเอกสารส่วนตัวไปยังเซิร์ฟเวอร์ที่คุณไม่ได้ควบคุม
- การแปลงเอกสารสำนักงานต้องติดตั้ง LibreOffice และจำกัดขนาดไฟล์อัปโหลดไว้ที่ 50 MB
- การดูตัวอย่างและพิมพ์รูปภาพขึ้นอยู่กับ Pillow และชนิดไฟล์ การรองรับ SVG/HEIC/HEIF อาจต้องติดตั้งไลบรารีเพิ่มเติม และไม่รับประกันว่าจะใช้ได้ทุกระบบ
- ระดับกระดาษและหมึกอาจแสดงเป็นไม่ทราบ หากเครื่องพิมพ์ไม่ได้รายงานข้อมูลผ่าน CUPS

## การติดตั้งเซิร์ฟเวอร์ Linux

ตัวอย่างหลักใช้คำสั่งสำหรับ Ubuntu/Debian หากใช้ดิสโทรอื่น ให้ดูหัวข้อการติดตั้งตามดิสโทรด้านล่าง

### 1. ติดตั้งสิ่งที่จำเป็น (Ubuntu/Debian)

    sudo apt update
    sudo apt install -y git python3 python3-venv python3-pip cups cups-client libreoffice

ติดตั้ง Node.js รุ่นที่รองรับ แนะนำ Node.js 22 LTS หรือใหม่กว่า หากแพ็กเกจของดิสโทรเก่าเกินไป ให้ติดตั้งจากเว็บไซต์ทางการของ Node.js หรือใช้ตัวจัดการเวอร์ชัน

เปิดใช้งาน CUPS และตรวจสอบระบบ:

    sudo systemctl enable --now cups
    lpstat -r
    lpstat -p

เพิ่มและตั้งค่าเครื่องพิมพ์ผ่านการตั้งค่าเครื่องพิมพ์ของดิสโทรหรือเครื่องมือดูแล CUPS จากนั้นลองพิมพ์หน้าทดสอบให้สำเร็จก่อนดำเนินการต่อ

### 2. ดาวน์โหลดโค้ด

    git clone https://github.com/atom3379/PrintHub.git
    cd PrintHub

### 3. ติดตั้ง dependencies ของ backend

    cd backend
    python3 -m venv .venv
    source .venv/bin/activate
    python -m pip install --upgrade pip
    pip install -r requirements.txt

เปิด API ในเทอร์มินัลนี้:

    uvicorn app.main:app --host 127.0.0.1 --port 8000

ปล่อยให้โปรแกรมทำงานระหว่างใช้งาน frontend โดย API จะรับการเชื่อมต่อจากเครื่องเดียวกันเท่านั้นตามที่ตั้งใจไว้

### 4. ติดตั้งและเปิด frontend

เปิดเทอร์มินัลอีกหน้าที่โฟลเดอร์หลักของโปรเจกต์:

    cd frontend
    npm install
    npm run dev -- --host 127.0.0.1

เปิด http://127.0.0.1:5173 ในเบราว์เซอร์บนเครื่องเดียวกัน โดย Vite จะส่งต่อคำขอ API ไปยัง backend ที่ 127.0.0.1:8000

หากต้องการสร้างไฟล์ frontend สำหรับนำไปใช้งาน:

    npm run build

คำสั่งนี้จะสร้างไฟล์ไว้ใน frontend/dist/ การติดตั้งปัจจุบันใช้ Vite development server หากจะนำไปใช้งานจริง ควรตั้งค่าเว็บเซิร์ฟเวอร์หรือ reverse proxy และระบบยืนยันตัวตนให้เหมาะสมก่อนเปิดให้เข้าถึงนอกเครือข่ายส่วนตัวที่เชื่อถือได้

### 5. ตรวจสอบ API และเครื่องพิมพ์

เปิด http://127.0.0.1:8000/api/health ในเบราว์เซอร์ ควรได้รับ JSON ที่มีค่า status เป็น ok

คำสั่งตรวจสอบที่มีประโยชน์:

    lpstat -r
    lpstat -p
    lpstat -d

หากดูตัวอย่างเอกสารสำนักงานไม่ได้ ให้ตรวจสอบว่าติดตั้ง LibreOffice แล้ว หากรูปภาพมีปัญหา ให้ตรวจสอบว่าได้ติดตั้ง Pillow ใน virtual environment ของ backend แล้ว

## คำแนะนำสำหรับดิสโทร Linux อื่น ๆ

ชื่อแพ็กเกจด้านล่างเป็นตัวอย่างเบื้องต้น ชื่อจริงอาจต่างกันตามรุ่นและคลังแพ็กเกจ ให้ติดตั้งแพ็กเกจที่เทียบเท่ากันหากชื่อเปลี่ยนไป

### Debian และ Ubuntu (APT)

    sudo apt update
    sudo apt install git python3 python3-venv python3-pip cups cups-client libreoffice

ติดตั้ง Node.js 22 LTS หรือใหม่กว่าหากเวอร์ชันในคลังเก่าเกินไป สำหรับระบบเซิร์ฟเวอร์แบบ minimal ต้องตั้งค่าไดรเวอร์/PPD ของเครื่องพิมพ์ หรือการรองรับ IPP แบบ driverless ให้เรียบร้อยด้วย

### Fedora (DNF รุ่นปัจจุบัน/รุ่นเสถียร)

    sudo dnf install git python3 python3-pip cups cups-client libreoffice
    sudo systemctl enable --now cups

จากโฟลเดอร์หลักของโปรเจกต์ สร้าง virtual environment ด้วย python3 -m venv backend/.venv ติดตั้ง Node.js 22 LTS หรือใหม่กว่าจากแพ็กเกจที่ Fedora มีให้ หรือจากแหล่งแจกจ่าย Node.js อย่างเป็นทางการหากจำเป็น

### Arch Linux และดิสโทร rolling release ที่ใช้ Arch (pacman)

ตัวอย่างเช่น Arch Linux, EndeavourOS และ Manjaro โดยแพ็กเกจที่มีให้อาจต่างกันในแต่ละดิสโทร

    sudo pacman -Syu
    sudo pacman -S --needed git python python-pip python-virtualenv nodejs npm cups cups-filters libreoffice-fresh python-pillow
    sudo systemctl enable --now cups

ดิสโทรที่อิง Arch บางตัวอาจใช้ชื่อแพ็กเกจ LibreOffice ต่างออกไป ให้เลือกแพ็กเกจที่มีอยู่ และอัปเดตระบบให้เรียบร้อยก่อนติดตั้งแพ็กเกจบน rolling release

### openSUSE Tumbleweed (Zypper; rolling release)

    sudo zypper refresh
    sudo zypper update
    sudo zypper install git python3 python3-pip python3-virtualenv nodejs npm cups libreoffice
    sudo systemctl enable --now cups

หากคลังแพ็กเกจมี Node.js รุ่นเก่า ให้ติดตั้งรุ่นที่รองรับในปัจจุบันแยกต่างหาก

### คำแนะนำทั่วไปสำหรับ rolling release หรือระบบที่อัปเดตเร็ว
- อัปเดตระบบด้วย package manager ประจำดิสโทรก่อน อย่าผสม package manager หรือคัดลอกคำสั่งของดิสโทรอื่นมาใช้
- ใช้ Python รุ่นที่รองรับและสร้าง virtual environment แยก อย่าใช้ sudo pip install กับ Python ของระบบ
- ใช้ Node.js 22 LTS หรือใหม่กว่าสำหรับ Vite หาก build ไม่ผ่าน ให้ตรวจสอบข้อกำหนดเวอร์ชัน Node.js ของ Vite
- เก็บไฟล์ package-lock.json ไว้ และใช้ npm ci เพื่อติดตั้งซ้ำตาม lockfile หลังจากสร้าง lockfile แล้ว ใช้ npm install เมื่อตั้งใจเปลี่ยน dependencies
- ติดตั้ง CUPS และ LibreOffice จากคลังแพ็กเกจของดิสโทร ตั้งค่าและทดสอบเครื่องพิมพ์ก่อนเริ่มไล่หาปัญหาใน PrintHub
- หากอัปเดตแล้วแอปมีปัญหา ให้ตรวจสอบข้อความผิดพลาดและเวอร์ชันแพ็กเกจก่อนลอง downgrade

## ตัวเลือกเพิ่มเติม: ใช้ systemd user services

บัญชีผู้ใช้ Linux สามารถตั้งค่า systemd user services ให้เปิด backend/frontend โดยอัตโนมัติหลังเข้าสู่ระบบได้ หากต้องการให้บริการทำงานโดยไม่มีการล็อกอินแบบโต้ตอบ ผู้ดูแลระบบสามารถเปิด systemd lingering หรือใช้คำสั่ง loginctl enable-linger "$USER" หากมีสิทธิ์

ไฟล์ service ที่ใช้บนเซิร์ฟเวอร์พัฒนาปัจจุบันอ้างอิง path และการติดตั้ง Node.js ของเครื่องนั้นโดยเฉพาะ อย่านำไปใช้กับเครื่องอื่นโดยไม่แก้ WorkingDirectory, ExecStart และ PATH ก่อน หากจะเปิดให้หลายคนใช้งานหรือใช้งานผ่านอินเทอร์เน็ต ควรใช้บัญชีบริการเฉพาะ กำหนดสิทธิ์ให้ชัดเจน ใช้ reverse proxy และมีระบบยืนยันตัวตน

## ตรวจสอบการพัฒนา

รันจากโฟลเดอร์หลักของโปรเจกต์:

    backend/.venv/bin/python -m py_compile backend/app/main.py

    cd frontend
    npm ci
    npm run build

## โครงสร้าง repository
- backend/ — FastAPI API และ dependencies ของ Python
- frontend/ — ส่วนติดต่อผู้ใช้ React/Vite
- storage/ — ไฟล์อัปโหลด ตัวอย่างเอกสาร และข้อมูลของงานพิมพ์ ไฟล์ภายในจะไม่ถูกส่งเข้า Git
- start-frontend.sh — สคริปต์ช่วยเปิด frontend ที่ใช้กับ systemd service ของเซิร์ฟเวอร์พัฒนา

## หมายเหตุด้านความปลอดภัย

PrintHub ยังไม่มีระบบยืนยันตัวตนหรือควบคุมสิทธิ์ ผู้ที่เข้าถึงหน้าเว็บได้อาจอัปโหลดไฟล์และสั่งพิมพ์ได้ ควรใช้งานเฉพาะในเครือข่ายส่วนตัวที่เชื่อถือได้ ห้ามตั้งค่า port forwarding หรือเปิดบริการนี้สู่อินเทอร์เน็ตโดยตรง
