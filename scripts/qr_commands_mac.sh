#!/bin/bash
# This script runs when a QR is scanned (macOS version).
# The Python script passes the QR text as the first argument ($1).

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY_BIN="$PROJECT_ROOT/.venv/bin/python"

TOKEN=$(echo "$1" | jq -r '.token')
MODE=$(echo "$1" | jq -r '.mode')

osascript -e "display notification \"Mode: $MODE\" with title \"QR Code Scanned!\""
echo "QR Detected ..."
echo "Content: $(echo "$1" | jq '.')"

$PY_BIN $PROJECT_ROOT/gate/manage.py process_token --token "$TOKEN" --mode "$MODE"
