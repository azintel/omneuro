#!/bin/bash
set -euo pipefail

echo "== FULL REDEPLOY START =="

# Who/where info
echo
echo "==== who/where ===="
whoami
hostname
date -u +"%Y-%m-%dT%H:%M:%S%z"

# Step 1: Build
echo
echo "==== STEP 1: BUILD ===="
/home/ubuntu/omneuro/scripts/deploy/01-build.sh

# Step 2: Restart
echo
echo "==== STEP 2: RESTART ===="
/home/ubuntu/omneuro/scripts/deploy/02-restart.sh

# Step 3: Sanity checks
echo
echo "==== STEP 3: SANITY ===="
/home/ubuntu/omneuro/scripts/deploy/03-sanity.sh

# Step 4: PM2 status
echo
echo "==== STEP 4: PM2 STATUS ===="
pm2 status

echo
echo "== FULL REDEPLOY COMPLETE =="