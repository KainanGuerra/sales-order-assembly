# 03 - Naming

| Thing | Convention | Example |
|---|---|---|
| Namespace | `<Org>.<Svc>.Api.<Layer>[.<Sub>]` | `Acme.Orders.Api.Application.Services` |
| Interface | `I` prefix | `IOrderService` |
| Service / repository / validator | `sealed class`, role suffix | `OrderService`, `OrderRepository`, `CreateOrderRequestValidator` |
| DTO | `sealed record`, `*Request` / `*Response` | `CreateOrderRequest`, `OrderResponse` |
| Endpoint file | `<Entity>Endpoints.cs` | `OrderEndpoints.cs` |
| Consumer | event name minus `Event`, plus `Consumer` | `PaymentProcessedConsumer` |
| Event | `<Noun><PastTense>Event` | `OrderPlacedEvent`, `TokenRevokedEvent` |
| Audit entity | `<Entity>Event` | `OrderEvent` |
| Private field | `_camelCase` | `_orderRepository` |
| Method | `Async` suffix | `CreateAsync` |
| TS file | kebab-case + role | `orders.service.ts`, `jwt-auth.guard.ts` |
| TS class | PascalCase + role | `OrdersRepository`, `HttpPaymentsClient` |
| TS DI token / constant | SCREAMING_CASE | `PAYMENTS_CLIENT`, `ORDER_TYPES` |

## Wire-level names
- **HTTP:** `/api/<plural>`; admin routes under `/admin` with a role requirement; every service has `GET /health` and `GET /version`.
- **Queues:** `<svc>-api-<event-kebab>`, set explicitly (`orders-api-payment-processed`). Default broker names collide across services.
- **Database:** schema and role per service (`orders` / `orders_role`); snake_case tables (`order_items`, `order_events`); enums stored as strings.
- **Env vars:** `Section__Key` in code and compose (`Postgres__Host`); `UPPER_SNAKE` in ConfigMaps and `.env`.
- **Error codes:** `UPPER_SNAKE` (`ORDER_CANCELED`), listed in the README.
- **Permissions:** `resource:action`, `*` for full access.
- **Log events:** dot-separated (`auth.login.failure`, `app.boot`).
- **Branches:** `feat/*`, `fix/*`, `refactor/*`.
- **Migrations:** EF timestamp + PascalCase (`20260901001429_MultiItemOrders`).
- **Helm resources:** `<svc>-api-config`. **Images:** `<registry>/<org>/<svc>`.

## Language
Code, comments, commits and READMEs in English. Narrative docs may be bilingual (see [10](10-comments-docs-commits.md)).
