#!/bin/bash
set -e
export NODE_ENV=production
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
