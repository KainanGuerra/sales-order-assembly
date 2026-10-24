# identity-api

Sellers, supervisors, clients (the portfolio) and credit. Owns the `identity` Postgres schema. Read by `orders-api` over gRPC and by the BFF over HTTP.

## What's here

- `src/db/schema.ts` - Drizzle tables (`supervisors`, `sellers`, `clients`). Money is integer cents; the seller's discount limit is in basis points (1% = 100). `price_table_id` is the id of a catalog table (no foreign key across services); it is null for a client without one.
- `src/modules/people/rules.ts` - the pure rules: who may see which portfolio (a seller only their own; a supervisor only the sellers they supervise), the price-table fallback, available credit.
- `src/modules/people/services/` - applies the rules. A seller asking for another seller's client gets the same answer as for a missing client, so ids cannot be probed.
- `src/modules/seed/` - loads this service's slice of `seed.json` at startup, idempotently. A restart never overwrites `credit_used_cents`, so credit consumed by orders survives.
- Two doors in one process:
  - HTTP for the BFF: `GET /login-options`, `POST /sessions/validate`, `GET /sellers/:id/clients`, `GET /clients/:id`, `GET /health`. The portfolio routes need the forwarded user (`x-user-id`, `x-user-role`).
  - gRPC for orders-api: `sales.identity.v1.IdentityService/GetClient` and `GetSeller` (`NOT_FOUND` when missing).
- Both require the `x-inner-auth` shared secret.

## Run standalone

```bash
# from the repository root:
sh scripts/init-env.sh   # generates .env with random passwords
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build identity-api
curl -s -H "x-inner-auth: $INNER_AUTH" localhost:13001/login-options
```

## Develop

The service installs `contracts` as a `file:` package, so build it first and reinstall after a contract change:

```bash
(cd ../contracts && pnpm install && pnpm build)
pnpm install
pnpm start:dev
```

## Test

```bash
pnpm test    # unit tests; the database tests are skipped without a database
TEST_DATABASE_URL=postgres://identity_role:<IDENTITY_DB_PASSWORD>@127.0.0.1:5432/sales pnpm test
```

The database tests run the real migrations in the `identity_test` schema of the compose Postgres.
