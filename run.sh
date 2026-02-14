#!/usr/bin/env bash
set -e

# Seed default templates on first run
if [ ! -d /data/templates ]; then
  echo "Seeding default templates to /data/templates..."
  cp -r /app/templates /data/templates
fi

# Seed default entity-mappings on first run
if [ ! -f /data/entity-mappings.json ]; then
  echo "Seeding default entity-mappings.json to /data/..."
  cp /app/config/entity-mappings.json /data/entity-mappings.json
fi

exec node /app/dist/index.js
