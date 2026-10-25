# web

The seller's app and the BFF it talks to. One Nuxt project: the pages run in the browser (SPA, `ssr: false`), and the Nitro server under `server/` is the only thing the browser reaches. It holds the session and calls `identity-api`, `catalog-api` and `orders-api`; the browser never sees those services or the shared secret.

## What's here

- `app/pages/` - login (pick a person), clients (the portfolio), the order screen, the order page (status, reason, history), and for supervisors the list of orders waiting (`/supervisor`) and the detail with Approve and Reject (`/approvals/:id`; rejecting asks for a reason from a list, and "Outro" needs a text).
  - **The order screen** is one mobile-first page: product search on top, the order lines below, totals and the Send button pinned at the bottom. After each edit (debounced 300 ms) it asks the backend to calculate; the totals, the blocking reasons and the status shown always come from that answer. The screen never computes them.
  - Send is enabled only when the backend said the order can be sent **and** nothing changed since.
- `app/stores/order.ts` (Pinia) - only what the seller typed: products, quantities, units, discounts, and the order id. The draft is kept in `localStorage`, so a reload or an expired session does not lose it. The order id is generated once per order and sent with it, so a retry never creates two orders.
- `app/composables/` - `useCalculation` and `useProductSearch` (TanStack Query, the key is the draft, so an old answer never replaces a newer one), `useSession`, `useApi` (sends the visitor to the login on a 401 and empties the cache).
- `app/utils/format.ts` - presentation only: cents to "R$ 322,80", basis points to "5%", and what a person types ("2,5") to basis points.
- `i18n/locales/pt-BR.json` - all the text (`@nuxtjs/i18n`, pt-BR only for now). The backend sends codes (`BELOW_MINIMUM`, `NOT_PACK_MULTIPLE`...); this file turns them into sentences.
- `server/` - the BFF:
  - `utils/session.ts`: the browser holds a random id in an HttpOnly cookie; the user lives in Redis with a sliding expiry, and logout deletes it.
  - `utils/backend.ts`: calls a backend service with the shared secret and the logged-in user (`x-user-id`, `x-user-role`).
  - `middleware/auth.ts`: every `/api` route except the login ones needs a session. `middleware/json-only.ts`: a request body must be JSON.
  - `api/`: `auth/*`, `clients`, `clients/:id/products` (the price table is read from the client, never from the browser), `orders/calculate`, `orders`, `orders/:id`.

## Run

From the repository root: `sh scripts/init-env.sh`, then `docker compose up`, and open `http://localhost:8080`. This is the only service that publishes a port.

For development of this app alone, start the rest with `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis rabbitmq catalog-api identity-api orders-api` (the dev override publishes their ports on loopback), then:

```bash
pnpm install
NUXT_INNER_AUTH=<INNER_AUTH from .env> \
NUXT_IDENTITY_URL=http://127.0.0.1:13001 NUXT_CATALOG_URL=http://127.0.0.1:13002 NUXT_ORDERS_URL=http://127.0.0.1:13003 \
NUXT_REDIS_URL=redis://:<REDIS_PASSWORD>@127.0.0.1:6379 pnpm dev
```

## Test

```bash
pnpm test        # Vitest: formatting, the order store, the session store, error mapping, debounce, JSON-only rule
pnpm typecheck   # vue-tsc (TypeScript 6: vue-tsc does not run on TypeScript 7 yet)
```

## Not done here

Component tests (the logic worth testing lives in the store, the helpers and the BFF, which are tested), order history with "repeat order" and the offline mode (phases B and C).
