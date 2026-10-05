#!/bin/sh
set -eu
command -v docker >/dev/null 2>&1 || { echo 'Install Docker with Compose and start its engine first.' >&2; exit 1; }
cd "$(dirname "$0")/.."
docker compose up --build --detach --wait
echo 'Kanban Studio: http://localhost:8000'
