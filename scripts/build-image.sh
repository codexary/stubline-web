#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export STUBLINE_WEB_VERSION
STUBLINE_WEB_VERSION=$(python3 -c 'import json; print(json.load(open("package.json"))["version"])')
docker compose build web
