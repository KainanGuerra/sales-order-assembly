# Mapa do código

Para achar rápido onde está cada coisa: onde mudar uma regra, como seguir um pedido da tela até o banco, como rodar um teste e como subir um serviço sozinho. Os caminhos são relativos a `repositories/` (nesta documentação, `../../<pasta>`). O porquê das regras está em [`ARCHITECTURE.md`](ARCHITECTURE.md) e em [`DECISIONS.md`](../../../DECISIONS.md).

## 1. Onde mudar o quê

| Quero mudar... | Arquivo (função) | Também mexer em |
|---|---|---|
| O pedido mínimo (R$ 300,00) | valor: `orders-api/src/config/env.ts` (`MIN_ORDER_CENTS`); regra: `orders-api/src/modules/orders/domain/order-rules.ts` (`calculateOrder`, bloqueio `BELOW_MINIMUM`) | `ASSUMPTIONS.md` A17, teste `order-rules.spec.ts` (299,99 × 300,00) |
| O limite de desconto (alçada) | `order-rules.ts` (`calculateOrder`: `effectiveDiscountLimitBp = min(do vendedor, MAX_DISCOUNT_BP)`, motivos `LINE_DISCOUNT_ABOVE_LIMIT` e `ORDER_DISCOUNT_ABOVE_LIMIT`) | o limite de cada vendedor vem do `seed/seed.json` do identity; `ASSUMPTIONS.md` A16, A27 |
| O arredondamento | `order-rules.ts` (`divideRoundHalfUp`; cada linha arredonda uma vez, o desconto do pedido sai da soma das linhas arredondadas) | `ASSUMPTIONS.md` A18, A28 (com os exemplos) e `order-rules.spec.ts` |
| Embalagem e múltiplos | `order-rules.ts` (bloqueios `PACK_NOT_AVAILABLE`, `NOT_PACK_MULTIPLE`, `INVALID_QUANTITY`) | |
| Produto repetido no pedido | `order-rules.ts` (bloqueio `DUPLICATE_PRODUCT`) | |
| Quando o crédito bloqueia | cálculo: `order-rules.ts` (`CREDIT_EXCEEDED`); decisão final: `identity-api/src/modules/people/rules.ts` (`creditInUseCents`, `fitsInCredit`) e `identity-api/src/modules/people/repository/people.repository.ts` (reserva em transação com `FOR UPDATE`) | `DECISIONS.md` D40 a D43 |
| Quanto dura uma reserva | `identity-api` env `RESERVATION_TTL_SECONDS` (900) | |
| As regras de status | `orders-api/src/modules/orders/domain/order-status.ts` (`decideApprove`, `decideReject`); o `UPDATE ... WHERE status = 'AWAITING_APPROVAL'` está em `orders-api/src/modules/orders/repository/orders.repository.ts` | D44, D47 |
| Os motivos de rejeição | `contracts/src/events/order-events.ts` (`REJECTION_REASON_CODES`) e `orders-api/src/modules/orders/dto/orders.dto.ts` | `web/server/utils/order-schemas.ts`, `web/i18n/locales/pt-BR.json` |
| Repetir pedido | `orders-api/src/modules/orders/domain/repeat-order.ts` (`buildRepeatDraft`) | |
| O que a busca mostra e em que ordem | visibilidade: `catalog-api/src/modules/products/search-rules.ts` (`classify`, `isVisible`); ordem: `catalog-api/src/modules/products/repository/products.repository.ts` (`orderBy`: descrição exata, similaridade, mais pedido, id) | flag `SHOW_UNAVAILABLE_PRODUCTS` |
| Quem é avisado de quê | `notifications-api/src/modules/notifications/domain/plan.ts` (`planPlaced`, `planSubmitted`, `planApproved`, `planRejected`) | D49 |
| A carteira do vendedor | `identity-api/src/modules/people/rules.ts` (`canAccessPortfolio`) e `identity-api/src/modules/people/services/people.service.ts` | |
| O que a tela mostra de um status | `web/app/components/StatusBadge.vue`, `web/i18n/locales/pt-BR.json` | |
| O reenvio do modo offline | decisão do que fazer com cada falha: `web/app/utils/connectivity.ts` (`classifyFailure`); a rodada de envio: `web/app/stores/pending.ts` (`flush`); quando tentar: `web/app/composables/usePendingSync.ts` (a cada 15 s) | tempo limite: `REQUEST_TIMEOUT_MS` (8 s) no mesmo `connectivity.ts` |
| Quando o app se considera sem sinal | `web/app/composables/useApi.ts` (hooks), `useConnectivity.ts`, `web/app/plugins/offline.client.ts` (sonda a cada 5 s) | |
| O que o service worker guarda | `web/nuxt.config.ts` (bloco `pwa`) | |
| A tabela de rede (quem fala com quem) | `<serviço>/k8s/values.yaml` (`networkPolicy`) | `orchestration/charts/sales-lib/templates/_networkpolicy.tpl` |

## 2. Seguindo um pedido, da tela ao banco

1. **Tela:** `web/app/pages/orders/new/[clientId].vue` mostra o pedido; `web/app/stores/order.ts` (Pinia) guarda só o que o vendedor digitou; `web/app/plugins/draft.client.ts` o mantém no `localStorage`.
2. **Cálculo a cada edição:** `web/app/composables/useCalculation.ts` chama `POST /api/orders/calculate` (com atraso de 300 ms).
3. **BFF:** `web/server/middleware/auth.ts` (sessão) e `json-only.ts`; a rota `web/server/api/orders/calculate.post.ts` valida a forma com Zod (`web/server/utils/order-schemas.ts`) e `web/server/utils/backend.ts` repassa ao serviço com `x-inner-auth` e o usuário.
4. **orders:** `orders-api/src/modules/orders/controllers/orders.controller.ts` chama `orders-api/src/modules/orders/services/orders.service.ts` (`calculate`/`submit`), que consulta `orders-api/src/modules/orders/clients/identity.client.ts` e `orders-api/src/modules/orders/clients/catalog.client.ts` (gRPC) e entrega tudo a `orders-api/src/modules/orders/domain/order-rules.ts` (`calculateOrder`, função pura).
5. **Envio:** `submit` confere se o `orderId` já existe, calcula, reserva o crédito (`this.identity.reserveCredit`, gRPC), grava com `orders-api/src/modules/orders/repository/orders.repository.ts` (pedido, itens e histórico numa transação) e publica `order.placed` (e `order.submitted` se dentro da alçada) por `orders-api/src/modules/orders/clients/order-events.publisher.ts`.
6. **Eventos:** identity (`identity-api/src/modules/people/controllers/order-events.controller.ts`), catalog (`catalog-api/src/modules/products/controllers/order-events.controller.ts`) e notifications (`notifications-api/src/modules/notifications/controllers/order-events.controller.ts`) consomem por `src/shared/messaging/consume.ts`, que é a mesma cópia nos três (`identity-api`, `catalog-api`, `notifications-api`).
7. **De volta à tela:** a resposta (ou o 422 com os motivos) volta pelo BFF; a tela de pedido, `OrderDetails.vue`, mostra o resultado.

## 3. Estrutura de cada serviço

Camadas são pastas (`DECISIONS.md` D1; `style-guide/`): controllers chamam serviços, serviços chamam repositórios, repositórios não têm regra. As regras ficam em funções puras, sem I/O.

```
<serviço>/src/
├── main.ts, app.module.ts        partida e composição
├── config/env.ts                 variáveis de ambiente validadas com Zod
├── db/schema.ts, database.module.ts   Drizzle; migrações em drizzle/ aplicadas na partida
├── modules/<módulo>/
│   ├── controllers/              HTTP, gRPC e consumidores de eventos
│   ├── services/                 casos de uso
│   ├── repository/               acesso ao banco (sem regra de negócio)
│   ├── domain/ (ou rules.ts)     funções puras: as regras
│   └── dto/                      Zod
├── modules/seed/                 importação idempotente do seed/seed.json do serviço
└── shared/                       guard de inner-auth, mensageria (consume, topology)
```

Rotas por serviço:

| Serviço | Rotas |
|---|---|
| `orders-api` | `POST /orders/calculate`, `POST /orders`, `GET /orders?clientId=`, `GET /orders/pending-approval`, `GET /orders/:id`, `GET /orders/:id/repeat`, `POST /orders/:id/approve`, `POST /orders/:id/reject` |
| `identity-api` | `GET /login-options`, `POST /sessions/validate`, `GET /sellers/:sellerId/clients`, `GET /clients/:clientId`; gRPC `GetClient`, `GetSeller`, `ReserveCredit`, `ReleaseCredit` |
| `catalog-api` | `GET /products`; gRPC `GetProducts` |
| `notifications-api` | `GET /notifications`, `GET /notifications/unread-count`, `GET /notifications/stream` (SSE), `POST /notifications/read-all`, `POST /notifications/:id/read` |
| todos | `GET /health` |
| `web` (BFF, `server/api`) | `auth/{options,login,logout,me}`, `clients`, `clients/:id`, `clients/:id/products`, `clients/:id/orders`, `orders/calculate`, `orders` (POST), `orders/:id`, `orders/:id/repeat`, `orders/:id/{approve,reject}`, `approvals`, `notifications/*` (inclui o fluxo), `health` |

## 4. Rodar um teste

Dentro da pasta do serviço (Node 24, `corepack pnpm`):

```bash
corepack pnpm exec vitest run <caminho do arquivo>            # um arquivo
corepack pnpm exec vitest run -t "parte do nome do teste"     # pelo nome
corepack pnpm test                                            # todos do serviço
```

Os testes que usam o banco só rodam com a variável apontando para o PostgreSQL do compose (`docker compose up -d postgres`); sem ela, são pulados. Detalhes e contagens em [`TESTING.md`](../testing/TESTING.md).

## 5. Subir um serviço sozinho

Cada serviço tem o próprio `README.md` com o comando. Em resumo, na raiz do projeto: `sh scripts/init-env.sh` e `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build <serviço>`; as portas de depuração estão em [`GETTING_STARTED.md`](../getting-started/GETTING_STARTED.md). Depois de mudar o `contracts`: `pnpm build` nele e `pnpm install` em cada serviço (`file:../contracts`).
