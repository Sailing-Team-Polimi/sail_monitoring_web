#!/bin/bash
set -e

echo "=========================================="
echo "⛵ Polimi Sailing Team - Web App Sviluppo"
echo "=========================================="

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$PROJECT_DIR/compose.dev.yaml"

echo "🔄 Creazione ambiente di sviluppo in corso..."
docker compose -f "$COMPOSE_FILE" up -d --build

echo "=========================================="
echo "✅ WORKSPACE PRONTO E IN ATTESA!"
echo "Istruzioni per i dev:"
echo "1. Apri VS Code -> 'Attach to Running Container' -> 'web-dev-workspace'"
echo "2. Apri il terminale integrato di VS Code"
echo "3. 🖥️  FRONTEND: cd FE && npm start (su localhost:4200)"
echo "4. ⚙️  BACKEND:  cd BE && npm run dev (su localhost:8080)"
echo "=========================================="