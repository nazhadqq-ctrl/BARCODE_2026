#!/bin/bash
set -e

# Find pnpm — try PATH first, fall back to the known nix-store path
PNPM=$(which pnpm 2>/dev/null || echo "/nix/store/61lr9izijvg30pcribjdxgjxvh3bysp4-pnpm-10.26.1/bin/pnpm")

echo "=== [1/2] Building React frontend ==="
PORT=5000 BASE_PATH=/ NODE_ENV=production \
  $PNPM --filter @workspace/barcode-app run build

echo "=== [2/2] Building API server ==="
(cd artifacts/api-server && $PNPM run build)

echo "=== Production build complete ==="
