# orders-api

Every rule about an order, and the order itself. Owns the `orders` Postgres schema. It reads prices and pack rules from `catalog-api` and clients and discount limits from `identity-api` over gRPC, and publishes `OrderSubmitted` to RabbitMQ.

## What's here

- `src/modules/orders/domain/order-rules.ts` - **the rule engine**: pure functions, no I/O. Quantity and pack conversion, pack-only products, line and order discounts, rounding (each line rounded half-up once; the order discount is taken from the sum of the rounded lines), the R$ 300.00 minimum on the final net total, the discount limit (the smaller of the seller's and the global ceiling), duplicate lines, products that are unknown, inactive or without a price. It returns the totals, every **blocking reason** (the order cannot be sent) and every **approval reason** (it can, but goes to a supervisor).
- `src/modules/orders/services/orders.service.ts` - gathers the data (client, seller, products) and runs the engine. A client of another seller answers like a missing one.
- `src/modules/orders/repository/` - saves an order and its lines in one transaction. The order id is the primary key, so a repeated submit is detected by the database; the line key (order, product) enforces one line per product.
- `src/modules/orders/domain/order-status.ts` - the life of an order, as pure rules: `AWAITING_APPROVAL → APPROVED → SUBMITTED`, or `REJECTED`. `APPROVED` is a step, never a resting state; every step is recorded in `order_status_history`. The database applies a decision with `UPDATE ... WHERE status = 'AWAITING_APPROVAL'`, so an approval and a rejection arriving together cannot both win.
- HTTP, all behind `x-inner-auth` plus the forwarded user (`x-user-id`, `x-user-role`):
  - `POST /orders/calculate` - totals and reasons. Saves nothing. Always 200 for a well-formed body; rule problems are in the answer.
  - `POST /orders` - sends the order. The body carries a client-generated `orderId`; sending it again returns the same order. 422 with the calculation if a rule blocks it.
  - `GET /orders/pending-approval` - the supervisor's list.
  - `GET /orders/:id` - the order, for the seller who sent it or the supervisor who has to decide on it (with its history).
  - `POST /orders/:id/approve` and `POST /orders/:id/reject` - for the supervisor of the order. Reject takes `{ reasonCode, reasonText? }` ("OTHER" needs a text). Repeating a decision returns the same result; a contradicting one is a 409.
- Credit: the engine blocks an order above the client's available credit (`CREDIT_EXCEEDED`, exactly what is left is allowed). The check in calculate is advisory; at submit the service reserves the credit in identity **before** saving (atomic there), and gives it back at once if saving fails.
- Prices and product data are copied onto each order line at submit time.

## Money and units

Money is integer cents, discounts are basis points (5% = 500), quantities are stored in units (a pack is converted with the pack factor). The request says how the seller entered it: `{ quantity: 2, unit: "PACK" }`.

## Events

After the order is saved, `order.placed` is published to the topic exchange `orders.events`, followed by `order.submitted` if it was within the discount limit. Approving publishes `order.approved` and `order.submitted`; rejecting publishes `order.rejected` (and gives the credit back directly as well). The payload is wrapped by Nest as `{ "pattern": "order.submitted", "data": { ... } }`; consumers use `@nestjs/microservices` and bind their own queue. Publishing is best effort: a broker failure is logged and the order stays saved (no outbox yet).

## Run standalone

```bash
# from the repository root:
sh scripts/init-env.sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build orders-api   # also starts what it depends on
```

## Develop and test

```bash
(cd ../contracts && pnpm install && pnpm build)
pnpm install
pnpm test    # rule engine and service tests; the database tests are skipped without a database
TEST_DATABASE_URL=postgres://orders_role:<ORDERS_DB_PASSWORD>@127.0.0.1:5432/sales pnpm test
```

The database tests run the real migrations in the `orders_test` schema of the compose Postgres.
