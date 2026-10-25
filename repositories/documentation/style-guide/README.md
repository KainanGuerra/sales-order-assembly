# Engineering style guide

How I design and build services. It describes architecture first and language second: I work in both .NET and TypeScript, and the same structure applies to either.

This guide is the baseline for the technical challenge in this repository. Choices that deviate from it, or that involve a real trade-off, are recorded in [`../DECISIONS.md`](../../../DECISIONS.md).

## Ten rules

1. **One service per bounded context**, each owning its data (own schema and role, or own database). No cross-service reads.
2. **Layers are folders**: `Domain -> Application -> Infrastructure -> Endpoints`. Handlers call services, never repositories. Repositories hold no business rules.
3. **One explicit composition root** (`Program.cs` / `main.ts`). No reflection, no auto-discovery, constructor injection only.
4. **Expected failures are values** (`Result`); exceptions are for faults. A database unique index is the real race guard.
5. **Services talk through events** (message broker, explicit queue names, idempotent consumers) or one typed HTTP client behind an interface.
6. **No shared runtime package.** The small kernel is copied into each service. Event contracts are fixed in the spec.
7. **Safe by default**: write switches off, dev never touches production data, secrets only from the environment.
8. **Observable**: structured JSON logs with a trace id, `/health`, `/version`.
9. **Every service ships complete**: Dockerfile, compose, `.env.example`, k8s chart, CI, README, tests.
10. **Comments say why.** Every non-obvious choice is logged with the alternative rejected and a "revisit if".

## Contents

| File | Topic |
|---|---|
| [01-principles.md](01-principles.md) | Architectural philosophy |
| [02-service-template.md](02-service-template.md) | Folder layout and bootstrap order (.NET, TypeScript) |
| [03-naming.md](03-naming.md) | Naming conventions |
| [04-communication.md](04-communication.md) | Events, outbox, idempotency, HTTP clients |
| [05-errors-validation.md](05-errors-validation.md) | Result pattern, validation, response shapes |
| [06-persistence-config.md](06-persistence-config.md) | Data access and configuration |
| [07-auth-observability.md](07-auth-observability.md) | Auth, logging, probes |
| [08-testing.md](08-testing.md) | Test layout and style |
| [09-devops.md](09-devops.md) | Docker, Kubernetes, CI |
| [10-comments-docs-commits.md](10-comments-docs-commits.md) | Comments, docs, decision log, commits |
| [11-checklist.md](11-checklist.md) | New-service and PR checklists, pitfalls to avoid |
