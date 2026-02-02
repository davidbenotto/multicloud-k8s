#!/bin/bash
# Utility script to kill any process using a specified port
# Usage: ./cleanup-port.sh [PORT]
# Default port: 3000

PORT=${1:-3000}
PID=$(lsof -ti :$PORT 2>/dev/null)

if [ -n "$PID" ]; then
  echo "🧹 Killing process $PID blocking port $PORT"
  kill -9 $PID 2>/dev/null
  sleep 1
  echo "✅ Port $PORT is now free"
else
  echo "✅ Port $PORT is already free"
fi
