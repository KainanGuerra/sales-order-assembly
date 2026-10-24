# 04 - Communication

## Async events (default between services)
- MassTransit over RabbitMQ, fanout publish. Events are plain `sealed record`s in `Contracts/`, copied per service.
- **Name receive endpoints explicitly.** The default queue name ignores the namespace, so same-named consumers in two services would compete for one queue. Leave a comment in `Program.cs` explaining this.
- **Transactional outbox** when a database write and a publish must be atomic: `AddEntityFrameworkOutbox<DbContext>(o => { o.UsePostgres(); o.UseBusOutbox(); })`. Order inside the service: `Publish`, write the audit row, `SaveChangesAsync`.
- Without an outbox, publish *after* `SaveChanges` and accept the small window.
- Retry: immediate intervals (1s, 2s, 3s, 4s), then scheduled redelivery (5, 15, 30 minutes).

## Idempotent consumers (mandatory)
Every consumer tolerates the same message twice. Key on `OrderId` / `UserId` and use one of:
1. Existence check (`ExistsForOrderAsync`).
2. Claim with a dedupe key (`TryClaimAsync`).
3. A domain method that no-ops once settled and returns `bool applied`.

## Synchronous HTTP (only when a reply is needed)
- One typed client behind an interface: `ICatalogClient` / `CatalogApiClient` (.NET), or a `PAYMENTS_CLIENT = Symbol(...)` token with `HttpPaymentsClient` (TS).
- Forward the caller's bearer token or an inner-auth header. Return `null` on 404. 10 second timeout. Propagate `x-request-id`.
- Two error types per client: `UpstreamError` (network or 5xx, worth retrying, surfaces as 503) and `*RejectedError` (a 4xx verdict, surfaces as 409/422). Services wrap calls in a `callX()` helper that does the mapping. The HTTP helper lives in one `integrations/http.ts`.
- Restrict the edge with a NetworkPolicy that allows exactly that call.

## Other patterns
- **Server-Sent Events** for live status: `TypedResults.ServerSentEvents` plus an in-process broadcaster, with a periodic ping.
- **External providers behind an interface**, chosen by a config *string*, never an enum: payment gateway, email sender, quotation provider. Ship a simulated or console implementation first; chain providers where fallback matters.
- **Idempotency keys** on outward calls.
- **No webhooks between my own services**; webhooks exist only at an external provider boundary.
- **Background work:** Hangfire (.NET) or Agenda (Node) on the existing store. Each run gets its own trace id and emits `job.started/finished/failed`. Interrupted jobs are reconciled at boot.

## gRPC for synchronous service-to-service calls
- Use it for queries that must be exact at the moment of the call. Contracts live in a separate `.proto` repository included as a git submodule.
- Batch the lookups (one call for all items), set a deadline on every call, and map gRPC status codes to the same errors the HTTP clients use (`UpstreamError` for unavailable, a rejected error for a verdict).
- Speed is not the justification: payloads are smaller and HTTP/2 helps, but the real gain is typed contracts. Measure before claiming a number.
- A browser-facing BFF talks plain HTTP to services and holds the shared inner-auth secret server-side only.
