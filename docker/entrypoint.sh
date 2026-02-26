#!/bin/sh
set -e

# Run database migrations if this is the app container (not worker)
if [ "$1" = "node" ] && echo "$2" | grep -q "index.js"; then
  echo "Running database migrations..."
  npx prisma migrate deploy
  echo "Migrations complete."
fi

exec "$@"
