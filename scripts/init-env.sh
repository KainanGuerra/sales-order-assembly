#!/bin/sh
# Creates .env from .env.example, filling every empty value with a random one.
# Leaves an existing .env alone.
set -eu
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo ".env already exists; leaving it as it is"
  exit 0
fi

while IFS= read -r line; do
  case "$line" in
    *=) printf '%s%s\n' "$line" "$(openssl rand -hex 16)" ;;
    *)  printf '%s\n' "$line" ;;
  esac
done < .env.example > .env

echo ".env created with generated values"
