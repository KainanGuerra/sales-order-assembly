# catalog-api

Products, price tables and search. Owns the `catalog` Postgres schema. Read by `orders-api` over gRPC and by the BFF over HTTP.

## What's here

- `src/db/schema.ts` - Drizzle tables (`products`, `price_tables`, `price_table_items`, `product_stats`, `counted_orders`). Tables are unqualified; the connection's `search_path` picks the schema, so the same code runs in `catalog` and in the `catalog_test` test schema.
- `drizzle/` - migrations. `0001_search_indexes.sql` is hand-written: an `IMMUTABLE` wrapper around `unaccent()` and a trigram index on the normalised description. They run at startup (Drizzle records applied migrations in its own table and runs only the pending ones).
- `src/modules/products/search-rules.ts` - the pure rules for what a seller sees (available / no price / inactive, and when each is shown).
- `src/modules/products/repository/` - the search query: exact EAN or SKU, otherwise accent-insensitive "contains" plus pg_trgm word similarity; exact description first, then closest, then units ordered, then id (which also orders the two products that share an EAN).
- `src/modules/products/controllers/order-events.controller.ts` - consumes `order.submitted` from its own quorum queue (`catalog-api-order-events`, with a `.dlq`) and adds the order's units to `product_stats`. `counted_orders` records each order id in the same transaction, so a redelivered event adds nothing. Search uses the total only after exact description and similarity, to decide between equally good matches (and between the two products that share an EAN).
- `src/modules/seed/` - loads this service's `seed/seed.json` at startup, idempotently (the file also ships in the image). Prices become integer cents.
- Two doors in one process: HTTP `GET /products?q=&priceTableId=&limit=` (and `GET /health`), and gRPC `sales.catalog.v1.CatalogService/GetProducts`. Both require the `x-inner-auth` secret.

## Run standalone

```bash
# from the repository root:
sh scripts/init-env.sh   # generates .env with random passwords
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build catalog-api
curl -s -H 'x-inner-auth: <INNER_AUTH>' 'localhost:13002/products?q=acucar&priceTableId=TP01'
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
TEST_DATABASE_URL=postgres://catalog_role:<CATALOG_DB_PASSWORD>@127.0.0.1:5432/sales pnpm test
```

The database tests run the real migrations in the `catalog_test` schema of the compose Postgres (start it with `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres`).

## Behaviour flags

`SHOW_UNAVAILABLE_PRODUCTS` (default `true`): an active product missing from the client's price table is shown disabled with the reason, and an inactive product appears when its exact EAN or SKU is typed. When `false`, both are hidden.
