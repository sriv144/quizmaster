#!/bin/sh
set -eu

pnpm --filter @quizmaster/api db:deploy
if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  pnpm --filter @quizmaster/api db:seed
fi
cd /app/apps/api
exec node dist/main.js
