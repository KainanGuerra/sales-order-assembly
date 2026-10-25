#!/bin/sh
# Creates the Secret every chart reads (passwords and the inner-auth secret) with
# random values. Leaves an existing Secret alone, so running the system again
# keeps the same passwords (the database already has them).
#   usage: create-secrets.sh [namespace]
set -eu
NAMESPACE="${1:-sales}"

if kubectl -n "$NAMESPACE" get secret sales-secrets >/dev/null 2>&1; then
  echo "secret sales-secrets already exists in $NAMESPACE; leaving it as it is"
  exit 0
fi

# One random value for each key the charts read (see the secretEnv of each values.yaml).
set --
for key in postgres-password identity-db-password catalog-db-password orders-db-password \
           notifications-db-password rabbitmq-password redis-password inner-auth; do
  set -- "$@" "--from-literal=$key=$(openssl rand -hex 16)"
done

kubectl -n "$NAMESPACE" create secret generic sales-secrets "$@"
