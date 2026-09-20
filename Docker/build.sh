#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
[[ "$SCRIPT_PATH" == */* ]] || SCRIPT_PATH="./$SCRIPT_PATH"
SCRIPT_DIR="$(cd -- "${SCRIPT_PATH%/*}" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/compose.yaml"

if [[ $# -ne 0 ]]; then
  echo 'Uso: bash Docker/build.sh (senza argomenti)' >&2
  exit 2
fi

command -v docker >/dev/null || { echo 'Docker non trovato. Installare Docker Desktop.' >&2; exit 1; }
docker compose version >/dev/null

echo 'Preparazione del container di sviluppo...'
docker compose -f "$COMPOSE_FILE" build
if ! docker compose -f "$COMPOSE_FILE" up --wait --wait-timeout 600; then
  echo 'Preparazione non completata. Ultimi messaggi del container:' >&2
  docker compose -f "$COMPOSE_FILE" logs --tail 100
  exit 1
fi

echo 'Container pronto. Dipendenze installate; Angular non avviato.'
echo 'Collegati al container con VS Code e apri /app/FE.'
echo 'Poi esegui: ng serve'
echo 'Il sito sara disponibile su http://localhost:4200'
