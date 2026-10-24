#!/bin/sh
# Runs once, on the first start of an empty data volume.
# One schema and one login role per service; a role can only use its own schema.
# Extensions live in "public" so every service can call their functions.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL

create_service_schema() {
  schema="$1"
  password="$2"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE ${schema}_role LOGIN PASSWORD '${password}';
CREATE SCHEMA ${schema} AUTHORIZATION ${schema}_role;
ALTER ROLE ${schema}_role SET search_path = ${schema}, public;
GRANT USAGE ON SCHEMA public TO ${schema}_role;
-- The migrator runs "CREATE SCHEMA IF NOT EXISTS" before it looks at anything,
-- and Postgres checks this privilege first. It does not give access to any
-- other service's schema, which still needs USAGE.
GRANT CREATE ON DATABASE "$POSTGRES_DB" TO ${schema}_role;
SQL
}

create_service_schema identity      "${IDENTITY_DB_PASSWORD:?IDENTITY_DB_PASSWORD must be set}"
create_service_schema catalog       "${CATALOG_DB_PASSWORD:?CATALOG_DB_PASSWORD must be set}"

create_service_schema orders        "${ORDERS_DB_PASSWORD:?ORDERS_DB_PASSWORD must be set}"
create_service_schema notifications "${NOTIFICATIONS_DB_PASSWORD:?NOTIFICATIONS_DB_PASSWORD must be set}"

# A second schema per service for integration tests: same owner, same
# migrations, no interference with the data the running service uses.
create_test_schema() {
  schema="$1"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE SCHEMA ${schema}_test AUTHORIZATION ${schema}_role;
SQL
}

create_test_schema identity
create_test_schema catalog
