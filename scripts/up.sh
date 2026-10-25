#!/bin/sh
# Frees every host port the compose file publishes, then runs `docker compose up`.
# Containers holding a port are stopped (not removed); any other process is killed.
# Usage: scripts/up.sh [docker compose up arguments]   (e.g. --build, -d)
# Dev ports too: COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml scripts/up.sh
set -eu
cd "$(dirname "$0")/.."

ports=$(docker compose config 2>/dev/null | sed -n 's/^ *published: "\{0,1\}\([0-9]*\)"\{0,1\}$/\1/p' | sort -u)

for port in $ports; do
  # Containers publishing the port (the project's own are recreated by compose anyway).
  for id in $(docker ps -q --filter "publish=$port"); do
    echo "port $port: stopping container $(docker inspect -f '{{.Name}}' "$id")"
    docker stop "$id" >/dev/null
  done
  # Anything else listening on it.
  pids=$(ss -ltnpH "sport = :$port" 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u)
  for pid in $pids; do
    echo "port $port: killing pid $pid ($(ps -o comm= -p "$pid"))"
    kill "$pid" 2>/dev/null || true
  done
done

exec docker compose up "$@"
