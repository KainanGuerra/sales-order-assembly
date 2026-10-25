# CLAUDE.md

## What this is

An order-assembly module for external sellers who visit small retailers and often have poor connectivity. The requirements are summarised in `repositories/documentation/context/CONTEXT.md`; the sample data is split per service: each of `identity-api`, `catalog-api` and `orders-api` has its own `seed/seed.json` (the slice it imports at start). They are copies of the supplied data with its imperfections kept on purpose (duplicate EAN, a client without a price table, prices with a decimal comma): do not clean them.

**The goal is code I can explain and defend.** Prefer the simple, readable option and say why in `DECISIONS.md`. Be honest about the gap: the author has not read the code line by line yet (see `repositories/documentation/pendings/PENDINGS.md`), so explain what you change.

## Status

`contracts`, `catalog-api`, `identity-api`, `orders-api` and `web` exist under `repositories/`, pass their tests and run in Docker Compose together with RabbitMQ (phase A backend is complete: calculate, submit with the status, the rules). `web` (Nuxt app and BFF) exists too, so the phase A requirements 1 to 6 are implemented end to end. Phase B is done: **credit, approval, history with "repeat order", notifications and the catalog's product statistic** (reservation and consumer; the supervisor's decisions with a status history; each client's history, which includes the seed's orders, and a draft that repeats an old order at today's prices). Phase C (offline) is done; phase D (Helm, kind with Calico, Traefik, network policies) runs on a local cluster, with the CI publishing the images to GHCR; everything lives in one repository (`DECISIONS.md` D60). Delivery was phased:

- **Phase A:** mandatory requirements 1–6 (portfolio scoping, product search by name/EAN with the client's price table, order building, totals and blocking rules, submit with status, automated tests of the rules).
- **Phase B:** credit limit, order history with "repeat order", minimal supervisor approve/reject.
- **Phase C (done):** offline drafting and sync: the app opens without signal (service worker), an order closed offline waits in the browser and is sent when the signal returns (`DECISIONS.md` D54 to D56).
- **Phase D (done, `DECISIONS.md` D57 to D59):** the `orchestration` folder: umbrella Helm chart with a chart per service, kind cluster with Calico, Traefik ingress, NetworkPolicies, Kubernetes getting-started guide. The compose file stays at the root (`DECISIONS.md` D60).

## Architecture

Full picture in `repositories/documentation/architecture/ARCHITECTURE.md` (and where things are in the code: `CODE_MAP.md`); reasoning in `DECISIONS.md` D15–D21.

- **Layout:** one git repo with the services as folders under `repositories/`; each installs `contracts` with `file:../contracts` (build it first) (`DECISIONS.md` D26, D60).
- **Services (one folder each):** `identity-api` (sellers, supervisor, clients, limits, credit used), `catalog-api` (products, price tables, search), `orders-api` (every order rule), `notifications-api` (supervisor notices), `web` (Nuxt UI + BFF), `contracts` (`.proto` + event schemas), `orchestration` (Helm, kind) and `documentation`; the root has `docker-compose.yml`, the CI and the decision documents.
- **Infra:** one PostgreSQL (one schema and one role per service, **no cross-schema queries**), RabbitMQ, Redis.
- **Browser → web only.** The Nuxt server is the BFF: it owns the session (Redis + cookie), validates the seller/supervisor pick with identity, and calls the services over HTTP with an inner-auth secret plus the user id and role.
- **orders → catalog / identity: gRPC**, batched, for both calculate and submit. **orders keeps no copies** of other services' data except price/product snapshots on order items.
- **RabbitMQ (`@nestjs/microservices` RMQ):** only events published by orders (`order.placed` on creation, `order.submitted` when SUBMITTED is reached, `order.approved`, `order.rejected`). Consumers are idempotent: identity (confirms or releases the credit reservation; built) and notifications (a notice per order, person and kind, announced to open screens through SSE; built); catalog (units ordered per product, used only to break ties in search; built). Consumer queues are quorum queues with a delivery limit and a `.dlq` dead-letter queue; a message that fails its schema is dead-lettered at once.
- **Credit is reserved synchronously.** At submit, orders calls identity `ReserveCredit` (gRPC) before saving the order, and `ReleaseCredit` if saving fails. identity locks the client row and holds the credit atomically, idempotent by order id; credit in use is *calculated* (already used + `CONFIRMED` + unexpired `PENDING` reservations), so an unconfirmed hold expires by itself (no job). `OrderPlaced` confirms the hold, `OrderRejected` releases it. See `ARCHITECTURE.md` §5 and `DECISIONS.md` D40 to D43.
- **Draft lives in the browser (Pinia).** After each edit the BFF asks orders to calculate; nothing is saved until submit.
- **Seed:** each service imports its own `seed/seed.json` at startup, idempotently; the file also ships inside the service's image.
- Phase A needs identity, catalog, orders and web; notifications arrived in phase B.
- **The browser holds only an opaque session id** (HttpOnly cookie); the user lives in Redis (`web/server/utils/session.ts`). The BFF's secret is read from a private `runtimeConfig` key (`NUXT_INNER_AUTH`) and never reaches the client. Every API request with a body must be JSON.
- **The screen never computes money or rules**: totals, blockers and status shown come from `POST /api/orders/calculate`; the order store (Pinia) holds only what the seller typed.

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
| Packaging | Docker, `docker compose up` (pull the published images from GHCR, or `--build`) |
| Package manager | pnpm 12 via corepack (install scripts denied; allow-list in `pnpm-workspace.yaml` `allowBuilds`) |

Exact versions are pinned in the code phase after checking compatibility. Frontend API types: undecided (generated vs hand-written).

## Domain rules (decided)

- **The backend owns every rule.** The frontend only displays and sends intent. It never recomputes totals or enforces limits.
- **Money is integer cents.** The seed files have reais as floats: convert on import. Format R$ only in the UI.
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

| File | Language | Read it for |
|---|---|---|
| `README.md` | pt-BR | How to run, test, and what was left out (root) |
| `DECISIONS.md` | pt-BR | Decisions: context, alternatives, choice, why, what I would do differently (root) |
| `ASSUMPTIONS.md` | pt-BR | Every ambiguity and the interpretation adopted (root) |
| `AI_LOG.md` | pt-BR | 3–5 significant AI moments (including one where the AI was wrong) and the authorship map (root) |
| `repositories/documentation/README.md` | pt-BR | Index of the documentation repo and how it is organised |
| `repositories/documentation/context/CONTEXT.md` | pt-BR | The problem, the requirements and where each is met, phases, decisions by theme, glossary |
| `repositories/documentation/architecture/ARCHITECTURE.md` | pt-BR | Services, data ownership, calls, life of an order, credit, events, notifications, session, offline, deployment, security |
| `repositories/documentation/architecture/CODE_MAP.md` | pt-BR | Where to change each rule, a request traced through the code, routes, how to run one test |
| `repositories/documentation/diagrams/` | pt-BR | Nine Mermaid diagrams, one per file |
| `repositories/documentation/getting-started/GETTING_STARTED.md` | pt-BR | Running (Compose, Kubernetes), `.env`, common problems |
| `repositories/documentation/testing/TESTING.md` | pt-BR | Test counts, how to run, mutation checks, what is not covered |
| `repositories/documentation/operations/RUNBOOK.md` | pt-BR | Logs, database, queues and dead letters, reset, cluster failures |
| `repositories/documentation/pendings/PENDINGS.md` | pt-BR | What is left to deliver, known limits, what I would do differently |
| `repositories/documentation/style-guide/` | en | How I structure services; follow it unless `DECISIONS.md` says otherwise |

Documentation rules (the pattern comes from an earlier project's documentation repo):

- **A change of behaviour updates the matching document in the same commit** (ARCHITECTURE, CODE_MAP if a file moved, GETTING_STARTED if a command changed, TESTING if counts changed, PENDINGS if something was finished or discovered), and `DECISIONS.md` / `ASSUMPTIONS.md` as before.
- The documentation is **Portuguese**, file names English `UPPER_SNAKE.md`, diagrams in Mermaid (one per file, Portuguese labels, a last line "Referenciado em ... §N"). The architecture text links to diagrams and never copies them. The style guide stays in English.
- **Never write the total number of decisions or assumptions as a literal number** anywhere; it changes. Cite entries as D*n* / A*n*.
- Links are relative (to the root files with `../../`).
- `CLAUDE.md` stays at the project root and is never renamed or split.

Before proposing a design change, **check `DECISIONS.md` and `ASSUMPTIONS.md` first.** Most alternatives were already considered, and each entry says what would reopen it.

## The life of an order

Two chains, six statuses, all real: `AWAITING_APPROVAL → APPROVED → SUBMITTED → INVOICED` and `AWAITING_APPROVAL → REJECTED → CANCELLED`. Within the discount limit an order is `SUBMITTED` from the start. A decision carries the order through the first two of its chain at once (approving: `APPROVED` then `SUBMITTED`; rejecting: `REJECTED` then `CANCELLED`), so afterwards it rests at `SUBMITTED` or `CANCELLED`; `order_status_history` records every hop. `INVOICED` ("Faturado") would be set by billing, which does not exist here: only the orders imported from the seed have it, and the seed's "Cancelado" is `CANCELLED`. The pure rules are in `repositories/orders-api/src/modules/orders/domain/order-status.ts`; the database applies a change with `UPDATE ... WHERE status = 'AWAITING_APPROVAL'`. Rejecting needs a reason from a fixed list ("Outro" needs a text). See `DECISIONS.md` D44 to D47.

## Where the rules live

`repositories/orders-api/src/modules/orders/domain/order-rules.ts` is the single place for pricing, packs, discounts, rounding, the minimum and the discount limit: a pure function with tests. Change a rule there, in `ASSUMPTIONS.md` and in the tests together.

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
- Whole system: `docker compose up --build` from a clean clone works (and `docker compose pull && docker compose up` with the published images).

## Writing rules

- No local filesystem paths, third-party company names, or credentials in any committed file.
- Documents are in Portuguese (pt-BR); code, comments and commits are in English.
