#!/bin/sh
# Builds the five images and loads them into the kind cluster, so the cluster
# needs no registry. The tag is "local" (the chart's default).
#   usage: build-images.sh [cluster-name]
set -eu
cd "$(dirname "$0")/../.."          # the folder with the services (repositories/)
CLUSTER="${1:-sales}"

for service in catalog-api identity-api orders-api notifications-api; do
  # These Dockerfiles also build the contracts package, so the context is this folder.
  docker build -q -t "sales-$service:local" -f "$service/Dockerfile" .
done
docker build -q -t sales-web:local web

for service in catalog-api identity-api orders-api notifications-api web; do
  kind load docker-image "sales-$service:local" --name "$CLUSTER"
done
