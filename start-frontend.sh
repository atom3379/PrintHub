#!/usr/bin/env bash
set -e
cd /home/atompwt/PrintHub/frontend
exec ./node_modules/.bin/vite --host 0.0.0.0 --port 5173 --strictPort
