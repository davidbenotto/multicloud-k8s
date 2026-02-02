#!/bin/bash
# Wrapper script to start clusters-web with port cleanup
# This ensures port 3000 is free before starting Next.js

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Clean up port 3000 before starting
"$SCRIPT_DIR/cleanup-port.sh" 3000

# Start the dev server
cd "$PROJECT_ROOT/apps/web"
npm run dev
