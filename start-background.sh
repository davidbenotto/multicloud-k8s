#!/bin/bash

# Start Docker containers (Postgres & Redis) with restart policy
echo "🚀 Starting Database containers..."
docker compose -f docker/docker-compose.yml up -d

# Wait for DB to be potentially ready (optional, but good practice)
echo "⏳ Waiting a few seconds for DB initialization..."
sleep 5

# Start PM2 processes
echo "🚀 Starting Applications with PM2..."
pm2 start ecosystem.config.js

# Display status
pm2 list

echo ""
echo "✅ Setup Complete!"
echo "To ensure these run after reboot, run the following command and follow the instructions:"
echo "  pm2 startup"
echo "Then, once you paste the command it gives you, run:"
echo "  pm2 save"
