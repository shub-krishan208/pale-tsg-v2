#!/bin/bash
# generate_keys.sh - Generate RSA key pair for JWT signing
# Run from project root: chmod +x scripts/generate_keys.sh && scripts/generate_keys.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

BACKEND_KEYS="$PROJECT_ROOT/backend/keys"
GATE_KEYS="$PROJECT_ROOT/gate/keys"

echo "🔐 Generating RSA key pair for JWT..."

# Create keys directories if they don't exist
mkdir -p "$BACKEND_KEYS"
mkdir -p "$GATE_KEYS"

# Check if keys already exist
if [ -f "$BACKEND_KEYS/private.pem" ] || [ -f "$GATE_KEYS/public.pem" ]; then
    read -p "⚠️  Keys already exist. Overwrite? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "❌ Aborted."
        exit 1
    fi
fi

# Generate private key
echo "   Generating private key..."
ssh-keygen -t rsa -b 2048 -m PEM -f "$PROJECT_ROOT/private.pem" -N ""

# Extract public key
echo "   Extracting public key..."
openssl rsa -in "$PROJECT_ROOT/private.pem" -pubout -outform PEM -out "$PROJECT_ROOT/public.pem"

# Move keys to their locations
mv "$PROJECT_ROOT/public.pem" "$GATE_KEYS/public.pem"
mv "$PROJECT_ROOT/private.pem" "$BACKEND_KEYS/private.pem"

# Clean up
rm -f "$PROJECT_ROOT/private.pem.pub"

echo "✅ Keys generated successfully!"
echo "   Private key: $BACKEND_KEYS/private.pem"
echo "   Public key:  $GATE_KEYS/public.pem"
