#!/bin/bash
# This script runs when a QR is scanned.
# The Python script passes the QR text as the first argument ($1).

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY_BIN=/home/freak/rack/code_rack/tsg/pale-tsg-v2/.venv/bin/python

TOKEN=$(echo "$1" | jq -r '.token')
MODE=$(echo "$1" | jq -r '.mode')

notify-send "QR Code Scanned!" "Mode: $MODE"
echo "QR Detected ..."
echo "Content: $(echo "$1" | jq '.')"

$PY_BIN $PROJECT_ROOT/gate/manage.py process_token --token "$TOKEN" --mode "$MODE"
