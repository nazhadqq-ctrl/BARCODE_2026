#!/bin/bash
set -e

PNPM=/nix/store/61lr9izijvg30pcribjdxgjxvh3bysp4-pnpm-10.26.1/bin/pnpm
API_PORT=8000

echo "Building API server..."
(cd artifacts/api-server && PORT=$API_PORT $PNPM run build)

echo "Starting API server on port $API_PORT..."
(cd artifacts/api-server && PORT=$API_PORT $PNPM run start) &
API_PID=$!

echo "Starting frontend on port 5000..."
PORT=5000 BASE_PATH=/ API_PORT=$API_PORT $PNPM --filter @workspace/barcode-app run dev &
FRONTEND_PID=$!

trap "kill $API_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait $FRONTEND_PID
kill $API_PID 2>/dev/null
