#!/usr/bin/env bash
set -e
cd /home/atompwt/PrintHub/frontend
while ! /usr/bin/tailscale ip -4 2>/dev/null | grep -q .; do sleep 2; done
TS_IP="$(/usr/bin/tailscale ip -4 | head -n1)"
exec ./node_modules/.bin/vite --host "$TS_IP" --port 5173 --strictPort
