#!/usr/bin/env bash
set -euo pipefail
ssh omneuro-prod 'cd ~/omneuro && git fetch origin && git reset --hard origin/main && pm2 reload brain-api --update-env && pm2 save'
