#!/bin/bash
# install.sh - Full installation script for PALE-TSG
# Run from project root: chmod +x scripts/install.sh && scripts/install.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "🚀 PALE-TSG Installation Script"
echo "================================"
echo ""

# Check Python version
echo "📦 Checking Python..."
if ! command -v python &> /dev/null; then
    echo "❌ Python not found. Please install Python 3.12+"
    exit 1
fi

PYTHON_VERSION=$(python --version 2>&1 | cut -d' ' -f2)
echo "   Found Python $PYTHON_VERSION"

# Setup virtual environment
echo ""
echo "📦 Setting up virtual environment..."
if [ ! -d ".venv" ]; then
    python -m venv .venv
    echo "   Created .venv"
else
    echo "   .venv already exists"
fi

# Activate venv
source .venv/bin/activate
echo "   Activated virtual environment"

# Install dependencies
echo ""
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt
echo "   Dependencies installed"

# Setup environment variables
echo ""
echo "⚙️  Setting up environment..."
if [ ! -f ".env" ]; then
    cp example.env .env
    echo "   Created .env from example.env"
    echo "   ⚠️  Please review .env and update values if needed"
else
    echo "   .env already exists"
fi

# Start Docker containers
echo ""
echo "🐳 Starting Docker containers..."
if command -v docker &> /dev/null; then
    docker compose up -d
    echo "   Containers started"
    echo "   Waiting for databases to be ready..."
    sleep 3
else
    echo "   ⚠️  Docker not found. Please start databases manually."
fi

# Run migrations
echo ""
echo "🗄️  Running database migrations..."
python backend/manage.py migrate
echo "   Backend migrations complete"
python gate/manage.py migrate
echo "   Gate migrations complete"

# Generate JWT keys
echo ""
echo "🔐 Setting up JWT keys..."
if [ ! -f "backend/keys/private.pem" ] || [ ! -f "gate/keys/public.pem" ]; then
    chmod +x scripts/generate_keys.sh
    scripts/generate_keys.sh
else
    echo "   Keys already exist, skipping..."
fi

# Install frontend dependencies
echo ""
echo "🎨 Setting up frontend..."
if [ -d "frontend" ]; then
    cd frontend
    if command -v npm &> /dev/null; then
        npm install
        echo "   Frontend dependencies installed"
    else
        echo "   ⚠️  npm not found. Please install Node.js and run 'npm install' in frontend/"
    fi
    cd "$PROJECT_ROOT"
fi

# Create Django superuser
echo ""
echo "👤 Django Admin Superuser"
read -p "   Create default superuser (admin/admin123)? (y/N): " create_superuser
if [[ "$create_superuser" =~ ^[Yy]$ ]]; then
    DJANGO_SUPERUSER_USERNAME=admin \
    DJANGO_SUPERUSER_EMAIL=admin@example.com \
    DJANGO_SUPERUSER_PASSWORD=admin123 \
    python backend/manage.py createsuperuser --noinput
    echo "   ✅ Superuser created (username: admin, password: admin123)"
else
    echo "   Skipped. Create manually: python backend/manage.py createsuperuser"
fi

echo ""
echo "================================"
echo "✅ Installation complete!"
echo ""

# Start servers
read -p "🚀 Start backend server? (Y/n): " start_backend
if [[ ! "$start_backend" =~ ^[Nn]$ ]]; then
    echo ""
    read -p "🎨 Also start frontend in background? (Y/n): " start_frontend
    
    if [[ ! "$start_frontend" =~ ^[Nn]$ ]]; then
        echo ""
        echo "Starting frontend (npm run dev)..."
        cd frontend
        npm run dev &
        FRONTEND_PID=$!
        cd "$PROJECT_ROOT"
        echo "   Frontend started (PID: $FRONTEND_PID)"
        echo ""
    fi
    
    echo "Starting backend (python backend/manage.py runserver)..."
    echo "   Press Ctrl+C to stop"
    echo ""
    python backend/manage.py runserver
else
    echo ""
    echo "To start manually:"
    echo "  Backend:  python backend/manage.py runserver"
    echo "  Frontend: cd frontend && npm run dev"
    echo ""
fi
