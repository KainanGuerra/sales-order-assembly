# 07 - Auth and observability

## Auth
- One service issues JWTs (HS256, fixed issuer and audience). Every other service only validates them through a copied `AddJwtAuthentication`.
- Roles `Player` and `Admin`; admin routes use `.RequireAuthorization(p => p.RequireRole("Admin"))`.
- **Revocation:** logout publishes `TokenRevokedEvent`; every service has a tiny `TokenRevokedConsumer` feeding an in-memory `ITokenRevocationStore`.
- **Hardening:** BCrypt, lockout (5 attempts, 15 minutes), a self-demotion guard, a 12-character password policy with a weak-password list.
- **Permission variant (TypeScript):** the token carries only `{ id, identifier, roles }`. Permissions are resolved by asking the auth service `GET /me` (short cache) in a `PermissionsGuard`. Keys are `resource:action`:
  ```ts
  @UseGuards(UserOrInnerGuard, PermissionsGuard) @RequirePermission('orders:read')
  ```
- **Service to service:** an `x-inner-auth` header (`InnerAuthGuard`, `UserOrInnerGuard`).
- Record actors as strings: `user:<id>`, `service:<name>`, `system:<name>`.
- A dev-token route exists only when `APP_ENV=development`.
- CORS is restricted outside local.

## Logging
- Serilog writes compact JSON to the console plus request logging; pino via `nestjs-pino` in TypeScript. `service`, `env` and `traceId` appear on every line.
- Templates use named placeholders, in English: `"Order {OrderId} placed by {UserId} for {ItemCount} game(s)"`. `LogWarning` for rejections, `LogInformation` for success.
- TypeScript: `logEvent(context, 'dot.separated.event', { fields }, level)`; the event names are catalogued in docs.
- `x-request-id` is reused or generated, propagated downstream and exposed to browsers.
- Redact authorization, cookie, `x-inner-auth`, password and tokens. Never log request bodies.
- No bare `console.log` or `Console.WriteLine` in service code.

## Probes
- `GET /health` and `GET /version` are public; `/api/<prefix>/version` is admin-only.
- Deployment readiness and liveness probes use `/health`.
- Errors carry a `traceId` (ProblemDetails extension or envelope field).
- No tracing or metrics stack unless the requirements ask for one.
