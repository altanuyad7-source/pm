#!/bin/sh
set -eu
command -v docker >/dev/null 2>&1 || { echo 'Docker with Compose is required.' >&2; exit 1; }
cd "$(dirname "$0")/.."
docker compose down
