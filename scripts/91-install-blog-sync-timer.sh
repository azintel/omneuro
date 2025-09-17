#!/bin/bash
set -euo pipefail

sudo systemctl daemon-reload
sudo systemctl enable --now omneuro-blog-sync.timer
echo "[OK] systemd blog sync timer enabled"