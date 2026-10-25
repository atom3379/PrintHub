# PrintHub

PrintHub is a self-hosted web dashboard for previewing documents and sending print jobs to a printer managed by CUPS. The interface uses React/Vite; the API uses FastAPI.

> **Project status:** early development. Test with non-sensitive documents first. There is currently no user authentication or access control. Do not expose the service directly to the public internet.

## Features

- Web dashboard with Thai/English interface.
- Upload and preview PDFs and common image formats.
- Convert supported office/text documents to PDF using LibreOffice.
- Submit supported files to the configured CUPS printer.
- Configure print options such as copies, page range, paper size, colour mode, orientation and pages per sheet.
- Save job metadata locally in storage/jobs.json.

**Current limitations**
- The print server/backend is designed for Linux with CUPS. Windows is supported as a browser client; for a Windows-hosted development environment, use WSL 2 with Ubuntu.
- The server must have a CUPS-compatible printer configured before printing works.
- Duplex printing depends on the printer and its driver; printers without automatic duplex require manual page flipping.
- No authentication, user accounts, real-time queue management, or public-internet deployment hardening yet.
- Uploads and print history are stored on the server. Do not upload private documents to a server you do not control.
- Conversion of office documents requires LibreOffice. Upload limit is 50 MB.
- Image preview/printing depends on Pillow and the image format. SVG/HEIC/HEIF preview support may require extra libraries and is not guaranteed on every installation.
- Printer paper and ink levels may display as unknown if the printer does not report them through CUPS.

## Using PrintHub from Windows

You do **not** need to install Python, Node.js, CUPS or the project on your Windows PC if PrintHub is already running on a Linux server.

1. Make sure the Linux server is running and reachable.
2. Open the PrintHub address provided by the server administrator in a browser. The server must be reachable from your device over the configured private network.
3. Upload a document or image, check its preview and print options, then submit the job.

If the page does not open, check that the server is running, your device can reach it over the configured network, and the frontend service is running. The backend should remain private behind the frontend proxy; do not expose port 8000 directly.

### Developing on Windows

The current backend relies on Linux CUPS commands such as lpstat and lp, so running the full print server natively on Windows is **not supported**. Recommended setup:

1. Install WSL 2 and an Ubuntu distribution.
2. Follow the Ubuntu/Linux setup below inside WSL 2.
3. For actual printing, ensure WSL can reach a working CUPS server and printer. Printer discovery and USB passthrough may need extra configuration; a separate Linux host running CUPS is usually simpler.
4. Use PowerShell for Windows-side Git commands if preferred, or use Git inside WSL consistently.

## Linux server setup

The examples below use Ubuntu/Debian-style commands first. Substitute package-manager commands for your distribution as described in the next section.

### 1. Install system dependencies (Ubuntu/Debian)

    sudo apt update
    sudo apt install -y git python3 python3-venv python3-pip cups cups-client libreoffice

Install a supported Node.js release (Node.js 22 LTS or newer is recommended for the current Vite dependencies). If your distribution's package is too old, use the official Node.js installation instructions or a version manager.

Enable CUPS and configure the printer:

    sudo systemctl enable --now cups
    lpstat -r
    lpstat -p

Add/configure your printer in your distribution's printer settings or CUPS administration tools. Confirm that a test page prints before continuing.

### 2. Get the code

    git clone https://github.com/atom3379/PrintHub.git
    cd PrintHub

Replace the placeholder with the HTTPS or SSH URL of the repository. If you cloned into a directory with a different name, cd into that directory instead.

### 3. Install backend dependencies

    cd backend
    python3 -m venv .venv
    source .venv/bin/activate
    python -m pip install --upgrade pip
    pip install -r requirements.txt

Start the API in this terminal:

    uvicorn app.main:app --host 127.0.0.1 --port 8000

Keep it running while using the frontend. The API binds to localhost on purpose.

### 4. Install and run the frontend

Open a second terminal at the project root:

    cd frontend
    npm install
    npm run dev -- --host 127.0.0.1

Open http://127.0.0.1:5173 in a browser on that same machine. Vite proxies API requests to the backend at 127.0.0.1:8000.

To build the frontend for a production-style deployment:

    npm run build

This generates frontend/dist/. The current setup is a development Vite server; a production deployment should use a properly configured web server/reverse proxy and authentication before allowing access beyond a trusted network.

### 5. Check the API and printer

In a browser, open http://127.0.0.1:8000/api/health. The expected response is JSON containing "status": "ok".

Useful checks:

    lpstat -r
    lpstat -p
    lpstat -d

If office documents do not preview, check that LibreOffice is installed. If images fail, check that Pillow is installed in the backend virtual environment.

## Package-manager notes for other Linux distributions

The package names below are starting points; names can vary by release and repository. Install the equivalent packages if a name has changed.

### Debian and Ubuntu (APT)

    sudo apt update
    sudo apt install git python3 python3-venv python3-pip cups cups-client libreoffice

Install Node.js 22 LTS or newer if the repository version is too old. On minimal/server installs, also make sure the printer's driver/PPD or driverless IPP support is configured.

### Fedora (DNF; current/stable release)

    sudo dnf install git python3 python3-pip cups cups-client libreoffice
    sudo systemctl enable --now cups

Create the virtual environment with python3 -m venv backend/.venv from the project root. Install Node.js 22 LTS or newer using Fedora's available module/package or the official Node.js distribution if needed.

### Arch Linux and Arch-based rolling releases (pacman)

Examples include Arch Linux, EndeavourOS and Manjaro. Package availability can differ between them.

    sudo pacman -Syu
    sudo pacman -S --needed git python python-pip python-virtualenv nodejs npm cups cups-filters libreoffice-fresh python-pillow
    sudo systemctl enable --now cups

Some Arch-based distributions may package LibreOffice differently (for example, a still/stable variant rather than libreoffice-fresh). Choose the available LibreOffice package. Keep the system fully updated before installing packages on a rolling release.

### openSUSE Tumbleweed (Zypper; rolling release)

    sudo zypper refresh
    sudo zypper update
    sudo zypper install git python3 python3-pip python3-virtualenv nodejs npm cups libreoffice
    sudo systemctl enable --now cups

If your repositories provide an older Node.js, install a current supported release separately.

### General guidance for rolling-release / bleeding-edge systems

- Update the system first using its normal package manager; avoid mixing package managers or copying package commands from a different distribution.
- Use a supported Python version and create an isolated virtual environment. Do not use sudo pip install into the system Python.
- Use Node.js 22 LTS or newer for the current Vite toolchain. If the distribution ships a newer Node release, that is usually fine, but check Vite's Node.js requirements if a build fails.
- Keep package-lock.json and use npm ci for reproducible installs after the first dependency lock is committed; use npm install when intentionally changing dependencies.
- Install CUPS and LibreOffice from your distribution's repositories. Configure and test the printer before debugging PrintHub itself.
- If an update breaks the app, check the error output and installed package versions before downgrading system packages.

## Optional: run as user services with systemd

For a Linux user account, systemd user services can start the backend/frontend automatically after login. To keep user services running without an interactive login, systemd lingering can be enabled by an administrator or with loginctl enable-linger "$USER" where permitted.

The service files used on the development server are specific to that machine's paths and Node.js installation. Do not copy them unchanged to another machine; update WorkingDirectory, ExecStart, and PATH first. For a public or multi-user deployment, prefer a dedicated service account, explicit permissions, a reverse proxy, and authentication.

## Development checks

From the project root:

    # Backend syntax check
    backend/.venv/bin/python -m py_compile backend/app/main.py

    # Frontend production build
    cd frontend
    npm ci
    npm run build

## Repository contents

- backend/ — FastAPI API and Python dependencies.
- frontend/ — React/Vite interface.
- storage/ — runtime uploads, previews and job metadata; contents are intentionally excluded from Git.
- start-frontend.sh — helper script used by the development server's systemd service.

## Security note

PrintHub currently has no authentication or authorization. Anyone who can reach the interface may be able to upload files and submit print jobs. Keep it on a trusted private network. Do not port-forward it or expose it directly to the internet.
