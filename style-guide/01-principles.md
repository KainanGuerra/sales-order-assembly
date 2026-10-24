# 01 - Principles

## Service boundaries
- One microservice per bounded context (users, catalog, orders, payments, notifications).
- One data store per service. With a shared Postgres instance: **one schema and one login role per service**, grants enforce the boundary, no cross-schema queries. With a document store: one database per service.
- Only one service talks to each external system. The others call that service (an "integrations" gateway), so third-party quirks live in one place.

## Layering is written down
- Dependency direction: `Domain -> Application (interfaces) -> Infrastructure (implementations) -> Endpoints`.
- Handlers call services only. Repositories do data access and nothing else: no validation, no business rules. State the rule in a folder comment.
- Domain invariants live in the entity: `private set`, behaviour methods, state transitions that return `bool` instead of throwing (`Order.MarkPaid()` is a no-op once settled).
- Layers are folders inside one project, not separate assemblies. Convention enforces direction.

## Explicit composition
- A single composition root wires everything: `Program.cs` or `main.ts`. In a modular monolith each module exposes `RegisterServices` and `Map<Module>` and the root calls them by name.
- Constructor injection only. An interface exists for anything a test needs to fake.

## Sharing
- No shared runtime package. The small kernel (`Shared/Kernel`, `Shared/Infrastructure`) is **copied** into each service and keeps its original namespace, so services deploy and version independently.
- Where drift matters, a small sync script with a `--check` mode flags copies that diverged.
- Event contracts are duplicated byte-for-byte per service in a `Contracts` namespace, with a header comment pointing at the spec section that defines them.

## Safe by default
- Anything that writes to a real system sits behind a flag defaulting to **off** (`<SYSTEM>_ALLOW_WRITES`, `<JOB>_ENABLED`).
- Dev compose overrides connection strings so local runs cannot write to production.
- Secrets come from the environment or a secret store, never from committed files.

## Contracts first
- Event names and payloads are fixed in the spec before code is written and are not renamed casually.
- The server computes money. A client never supplies a price.
- Order and payment state moves one way only (`Pending -> Paid | Failed`).

## Decisions are recorded
Every choice with a trade-off goes into an append-only decision log with the alternative rejected and a "revisit if". See [10](10-comments-docs-commits.md).
