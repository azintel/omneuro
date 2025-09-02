#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ubuntu/omneuro/apps/tech-gateway"
LOG_DIR="/home/ubuntu/deploy-logs"
mkdir -p "$LOG_DIR"

echo "=== [BUILD] tech-gateway: npm ci (idempotent) ==="
cd "$APP_DIR"
npm ci --no-audit --no-fund

BUILD_LOG="$LOG_DIR/build-tech-gateway-$(date +%Y%m%d-%H%M%S).log"
echo "=== [BUILD] tech-gateway: tsc (diagnostics, 180s timeout) → $BUILD_LOG ==="

# Run TypeScript compiler with lots of signal:
#  --pretty false: cleaner logs
#  --extendedDiagnostics: timing, memory, cache info
#  --listFiles: which files are being compiled
#  --traceResolution: how module resolution is happening (common source of hangs)
#  --generateCpuProfile: profile to inspect if needed
timeout 180s npx tsc --pretty false \
  --extendedDiagnostics \
  --listFiles \
  --traceResolution \
  --generateCpuProfile "$LOG_DIR/tsc-tech-gateway.cpuprofile" \
  2>&1 | tee "$BUILD_LOG"

echo "=== [BUILD] tech-gateway: build completed ==="