#!/bin/sh
set -eu

cd /app/FE
rm -f /tmp/sail-dev-ready
echo 'Installazione delle dipendenze nel volume Docker...'
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  # The first start also writes FE/package-lock.json on the host.
  npm install --no-audit --no-fund
fi

touch /tmp/sail-dev-ready
echo 'Dipendenze installate. Workspace pronto; Angular non avviato.'
exec "$@"
