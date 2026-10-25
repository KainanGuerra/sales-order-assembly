# notifications-api

Tells sellers and supervisors what happens to orders. Owns the `notifications` Postgres schema. Fed by `orders-api`'s events, read by the BFF over HTTP.

## What's here

- `src/modules/notifications/domain/plan.ts` - the pure rule: for each event, who gets which notification, and whether the event closes the ones that asked for a decision. Everything else carries the plan out.
- `src/db/schema.ts` - one `notifications` table, unique per (order, recipient, kind). A repeated event adds nothing, so redelivery is harmless. `read_at` keeps the first moment it was read; `resolved_at` is set when the order is decided.
- `src/modules/notifications/controllers/order-events.controller.ts` - consumes `order.placed`, `order.submitted`, `order.approved` and `order.rejected` from the quorum queue `notifications-api-order-events` (dead letters in `.dlq`), with the same retry and dead-letter handling as the other consumers.
- HTTP for the BFF, all about the forwarded user (`x-user-id`, `x-user-role`) and behind `x-inner-auth`:
  - `GET /notifications?limit=` (newest first, default 30, at most 100)
  - `GET /notifications/unread-count`
  - `POST /notifications/:id/read` (404 for somebody else's)
  - `POST /notifications/read-all`
  - `GET /notifications/stream` (SSE): `changed` when the list is stale (also once on connect), `ping` as a heartbeat. It carries no content: the screen asks for the list again.
- The broadcaster is in-process; with several replicas it would need a broker between them.

## Run standalone

```bash
# from the repository root:
sh scripts/init-env.sh   # generates .env with random passwords
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build notifications-api
curl -s -H "x-inner-auth: $INNER_AUTH" -H "x-user-id: S01" -H "x-user-role: SUPERVISOR" localhost:13004/notifications
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
TEST_DATABASE_URL=postgres://notifications_role:<NOTIFICATIONS_DB_PASSWORD>@127.0.0.1:5432/sales pnpm test
```

The database tests run the real migrations in the `notifications_test` schema of the compose Postgres.
