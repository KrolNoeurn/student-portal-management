#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
PYTHON_BIN="$BACKEND_DIR/.venv/bin/python"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

# Ensure Node/npm is available (supports nvm installations on macOS/Linux)
if ! command -v npm >/dev/null 2>&1; then
  if [ -d "$HOME/.nvm/versions/node" ]; then
    LATEST_NODE_BIN="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -n 1 || true)"
    if [ -n "$LATEST_NODE_BIN" ]; then
      export PATH="$LATEST_NODE_BIN:$PATH"
    fi
  fi
fi

if [ ! -x "$PYTHON_BIN" ]; then
  echo "Error: Python virtualenv not found at $PYTHON_BIN"
  echo "Run: cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm not found on PATH. Please install Node.js 20+ or load nvm."
  exit 1
fi

# Create default .env files if missing
if [ ! -f "$BACKEND_DIR/.env" ] && [ -f "$BACKEND_DIR/.env.example" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "Created backend/.env from backend/.env.example"
fi

if [ ! -f "$FRONTEND_DIR/.env" ] && [ -f "$FRONTEND_DIR/.env.example" ]; then
  cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"
  echo "Created frontend/.env from frontend/.env.example"
fi

# Install frontend dependencies if node_modules is missing
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm --prefix "$FRONTEND_DIR" install
fi

# Optional --migrate flag to apply migrations & seed defaults before starting
if [ "${1:-}" = "--migrate" ]; then
  echo "Running Django migrations and idempotent seeders..."
  "$PYTHON_BIN" "$BACKEND_DIR/manage.py" migrate
  "$PYTHON_BIN" "$BACKEND_DIR/manage.py" seed_system_defaults
  "$PYTHON_BIN" "$BACKEND_DIR/manage.py" seed_academic_defaults
  "$PYTHON_BIN" "$BACKEND_DIR/manage.py" seed_examination_defaults
  "$PYTHON_BIN" "$BACKEND_DIR/manage.py" seed_roles_permissions
fi

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  echo "Stopping SAMS development servers..."
  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  echo "All servers stopped."
}

trap cleanup INT TERM EXIT

echo "============================================================"
echo " Starting SAMS (Student Portal & Academic Management System)"
echo "============================================================"
echo " Frontend (Vite):  http://localhost:${FRONTEND_PORT}"
echo " Backend API:      http://127.0.0.1:${BACKEND_PORT}/api/v1/"
echo " Swagger Docs:     http://127.0.0.1:${BACKEND_PORT}/api/docs/"
echo " Django Admin:     http://127.0.0.1:${BACKEND_PORT}/admin/"
echo " Press Ctrl+C to stop both servers."
echo "============================================================"

(
  cd "$BACKEND_DIR"
  exec "$PYTHON_BIN" manage.py runserver "127.0.0.1:${BACKEND_PORT}"
) &
BACKEND_PID=$!

(
  cd "$FRONTEND_DIR"
  exec npm run dev -- --port "${FRONTEND_PORT}"
) &
FRONTEND_PID=$!

# Keep running until either process exits or Ctrl+C is pressed
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 1
done
