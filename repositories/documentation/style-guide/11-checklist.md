# 11 - Checklists

## New microservice
- [ ] Bounded context named; it owns its data (schema and role, or database). No cross-schema reads.
- [ ] Layout from [02](02-service-template.md); `Shared/` copied with namespaces untouched.
- [ ] `Program.cs` in the standard order; migrations applied at startup.
- [ ] Config through env (`Section__Key`); `.env.example` committed; no secrets in `appsettings`.
- [ ] Endpoints under `/api/<plural>`; `GET /health`, `GET /version`; auth on everything else.
- [ ] Result for expected failures; global exception handler; ProblemDetails with `traceId`.
- [ ] FluentValidation validators called explicitly.
- [ ] Events in `Contracts/`, explicit queue names, idempotent consumers; outbox if a write and a publish must be atomic.
- [ ] Audit `<Entity>Event` table wherever events are emitted.
- [ ] Serilog JSON, named placeholders, redaction.
- [ ] Unit tests for services, domain, validators and consumers.
- [ ] Dockerfile (multi-stage, non-root), compose with health-gated dependencies, `postgres-init`.
- [ ] Helm subchart: Deployment, security context, probes, `wait-for-postgres`.
- [ ] CI workflow; README in the standard section order; `DECISIONS.md` entries.

## PR self-review
- [ ] Handler to service to repository direction respected; no rules in repositories.
- [ ] No price or amount trusted from the client.
- [ ] Every consumer is safe to receive the same message twice.
- [ ] A unique index backs every uniqueness rule.
- [ ] No secret, token or real hostname committed.
- [ ] Any new env var is in `.env.example`, compose and the ConfigMap.
- [ ] Comments say why; no TODOs; docs updated in the same commit.
- [ ] A decision with a trade-off has a `DECISIONS.md` entry.

## Pitfalls I avoid
- Dead code copied across services (unused hasher or token service).
- A `v1` folder with unversioned URLs: version both or neither.
- Empty `test/` directories.
- Mixed DI lifetimes, block namespaces, `Console.WriteLine` in new code.
- Open CORS or unauthenticated endpoints outside local.
- Credentials in config files.
- A dev `.env` that points at production by default.
- Services without CI.
- Lines far past the configured `printWidth`; copy-pasted doc comments.
