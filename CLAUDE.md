# CLAUDE.md

## What this is

A technical challenge: an order-assembly module for external sellers who visit small retailers and often have poor connectivity. The raw brief is in `SCOPE.md` (Portuguese); the data is in `seed.json`. Use `seed.json` as is, with its imperfections. Never edit it.

The reviewers will pick code at random and ask me to explain it, make a live change, and debug a defect they inject. **Everything must be code I can explain.** Prefer the simple, readable option and say why in `DECISIONS.md`.

## Status

`contracts` and `catalog-api` exist under `repositories/` and pass their tests; `catalog-api` also runs in Docker Compose. `identity-api`, `orders-api` and `web` do not exist yet. Delivery is phased:

- **Phase A:** mandatory requirements 1–6 (portfolio scoping, product search by name/EAN with the client's price table, order building, totals and blocking rules, submit with status, automated tests of the rules).
- **Phase B:** credit limit, order history with "repeat order", minimal supervisor approve/reject.
- **Phase C:** offline drafting and sync (behaviour still to be decided).

## Architecture

Full picture in `ARQUITETURA.md`; reasoning in `DECISIONS.md` D15–D21.

- **Local layout today:** one git repo (the umbrella) with the services as folders under `repositories/`; each installs `contracts` with `file:../contracts` (build it first). They become separate repos and a submodule later (`DECISIONS.md` D9, D26).
- **Services (one repo each, placeholder names):** `identity-api` (sellers, supervisor, clients, limits, credit used), `catalog-api` (products, price tables, search), `orders-api` (every order rule), `notifications-api` (supervisor notices), `web` (Nuxt UI + BFF), `contracts` (`.proto` + event schemas, used as a git submodule), plus an umbrella repo with the deliverable docs, `docker-compose.yml`, CI and submodules.
- **Infra:** one PostgreSQL (one schema and one role per service, **no cross-schema queries**), RabbitMQ, Redis.
- **Browser → web only.** The Nuxt server is the BFF: it owns the session (Redis + cookie), validates the seller/supervisor pick with identity, and calls the services over HTTP with an inner-auth secret plus the user id and role.
- **orders → catalog / identity: gRPC**, batched, for both calculate and submit. **orders keeps no copies** of other services' data except price/product snapshots on order items.
- **RabbitMQ (`@nestjs/microservices` RMQ):** only events published by orders (`OrderSubmitted`, `OrderApproved`, `OrderRejected`). Consumers are idempotent: identity (confirms or releases the credit reservation), catalog (product stats), notifications (supervisor notice).
- **Credit is reserved synchronously.** At submit, orders calls identity `ReserveCredit` (gRPC; atomic conditional update, idempotent by order id) before saving the order, and `ReleaseCredit` if saving fails. Reservations are `pendente` until `OrderSubmitted` confirms them; identity releases `pendente` ones older than 15 minutes. See `ARQUITETURA.md` "Reserva de crédito" and `DECISIONS.md` D22.
- **Draft lives in the browser (Pinia).** After each edit the BFF asks orders to calculate; nothing is saved until submit.
- **Seed:** each service imports its own slice of `seed.json` at startup, idempotently.
- Phase A needs identity, catalog, orders and web; notifications arrives in phase B.

## Stack

| Concern | Choice |
|---|---|
| Frontend | Nuxt (Vue 3), TypeScript, SSR off |
| UI | Nuxt UI |
| Client state | Pinia |
| Server state | TanStack Query (vue-query) |
| Backend | NestJS 12, TypeScript 7, Node 24 |
| DTOs / validation | Zod schemas with Nest 12's built-in `StandardSchemaValidationPipe` (no `nestjs-zod`), owned by the backend |
| ORM / migrations | Drizzle ORM + `drizzle-kit` (pin the exact version; v1.0 was still beta/RC) |
| Database | PostgreSQL with `pg_trgm` and `unaccent` |
| Tests | Vitest everywhere |
| Service calls | gRPC (sync), RabbitMQ via `@nestjs/microservices` (async) |
| Session | Redis, owned by the Nuxt BFF |
| Packaging | Docker, `docker compose up`, images on GHCR |
| Package manager | pnpm 12 via corepack (install scripts denied; allow-list in `pnpm-workspace.yaml` `allowBuilds`) |

Exact versions are pinned in the code phase after checking compatibility. Frontend API types: undecided (generated vs hand-written).

## Domain rules (decided)

- **The backend owns every rule.** The frontend only displays and sends intent. It never recomputes totals or enforces limits.
- **Money is integer cents.** `seed.json` has reais as floats: convert on import. Format R$ only in the UI.
- **Discounts are integer basis points** (1% = 100): 5% is 500. Internal status codes are `SUBMITTED` and `AWAITING_APPROVAL`; the UI shows "Enviado" / "Aguardando aprovação".
- **Quantities are in units.** The seller may choose "unit" or "pack" in the UI; it is converted to units and priced per unit. Pack-only products (`venda_somente_multiplo`) require multiples of `fator_embalagem`.
- **Line total** = unit price × quantity × (1 − discount%), rounded once, half-up. **Order discount** applies to the sum of rounded lines and is rounded once. Discounts: per item **plus** an order-level one.
- **Discount limit (alçada):** the seller's limit is checked separately on each line % and on the order %. Within the limit (≤) → "Enviado"; above → "Aguardando aprovação".
- **Minimum order:** R$ 300.00 on the final net total (≥ 300.00 can be sent).
- **Credit (phase B):** an order above the client's available credit is blocked. Orders already "Enviado" or "Aguardando aprovação" count against it.
- **Price table:** a client with none (C004) falls back to the standard table (TP01) and the UI flags it.
- **Unavailable products:** behind env flags. An active product missing from the client's table is shown but disabled with the reason. An inactive product (`ativo: false`) is hidden from search, but an exact EAN/SKU match shows it with the reason.
- **Search:** fuzzy (`pg_trgm`, accent-insensitive) on name; exact on EAN. Duplicate EAN returns both products, ordered by exact description match, then id.
- **Repeat order (phase B):** copy items, re-price from the client's current table, skip unavailable items with a visible message.
- **Sessions:** the login screen picks a seller or the supervisor; a server-side session cookie scopes every query. A seller never sees another seller's clients.

Every one of these is also written, with the reasoning, in `ASSUMPTIONS.md` / `DECISIONS.md`. If you change a rule, change those files in the same commit.

## Documents

| File | Language | Purpose |
|---|---|---|
| `SCOPE.md` | pt-BR | The brief as received. Read-only |
| `README.md` | pt-BR | How to run, test, and what was left out |
| `ARQUITETURA.md` | pt-BR | Services, data ownership, calls, events, session |
| `DECISIONS.md` | pt-BR | Decisions: context, alternatives, choice, why, what I would do differently |
| `ASSUMPTIONS.md` | pt-BR | Every ambiguity and the interpretation adopted |
| `AI_LOG.md` | pt-BR | 3–5 significant AI moments (including one where the AI was wrong) and the authorship map |
| `style-guide/` | en | How I structure services; follow it unless `DECISIONS.md` says otherwise |

Before proposing a design change, **check `DECISIONS.md` and `ASSUMPTIONS.md` first.** Most alternatives were already considered, and each entry says what would reopen it.

## Hard rules

**Architecture**
- Layers are folders: Domain → Application → Infrastructure → Endpoints/Controllers. Controllers call services, services call repositories, repositories hold no business rules.
- Pure rule functions (pricing, packs, discounts, minimum, credit) take plain data and return plain data, with no I/O, so they are trivial to unit-test.
- Constructor injection; one explicit composition root.

**Data**
- One schema owned by this project; migrations through `drizzle-kit`, applied on start.
- Database unique indexes back every uniqueness rule.
- Submitting an order is idempotent (client-generated key), and prices are snapshotted on the order at submit time.

**Security and config**
- The BFF's inner-auth secret is server-only: private `runtimeConfig` in Nuxt, never `public`/`NUXT_PUBLIC_*`, never in a response, error body or log. Only `web` publishes a port to the host; backend services stay on the internal network. After a frontend build, grep the client bundle for the secret value.
- Secrets only from the environment; `.env.example` committed, `.env` ignored. Config validated with Zod at startup.
- No request bodies in logs; structured JSON logs with a trace id.

**Tests**
- Every business rule has a Vitest test named after the rule, including the boundary cases: discount exactly at the limit, subtotal R$ 299.99 vs R$ 300.00, quantity not a pack multiple, available credit exactly equal to the total, and the rounding examples from `ASSUMPTIONS.md`.

## Commits

- Conventional Commits in English, lowercase, with an optional scope: `feat(orders): block submit below the minimum`.
- **The last line of every commit message is the AI-use declaration**, one of `IA: nenhuma`, `IA: parcial`, `IA: majoritária`. Nothing after it, and no `Co-Authored-By` trailer.
- Never squash or rewrite history. Work on `feat/*` branches.
- I (Claude) do not commit unless asked. When asked, I propose the `IA:` level honestly; the user confirms it.

## AI usage log

Keep `AI_LOG.md` current as work happens. When the AI gets something wrong, or I reject its suggestion, add a note while it is fresh.

## Verification bar

- Backend: `pnpm test` (Vitest) green and the app answering `GET /health`.
- Frontend: lint and build pass; exercise the changed flow in the browser when UI changes.
- Whole system: `docker compose up` from a clean clone (`--recurse-submodules`) works.

## Writing rules

- No local filesystem paths, third-party company names, or credentials in any committed file.
- Deliverable documents are in Portuguese (pt-BR); code, comments and commits are in English.
