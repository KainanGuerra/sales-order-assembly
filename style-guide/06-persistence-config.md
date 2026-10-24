# 06 - Persistence and configuration

## Persistence
- EF Core with Npgsql, code-first. One schema and one role per service: `modelBuilder.HasDefaultSchema(Schema)`, search path in the connection string, grants in `postgres-init/init-schema.sh`.
- `Entity` base: `Guid Id`, `CreatedAtUtc`, `UpdatedAtUtc`, `Touch()`. `IRepository<T>`: `GetByIdAsync`, `GetPagedAsync`, `AddAsync`, `Update`, `Remove`, `SaveChangesAsync`. Service-specific repository interfaces extend it.
- **The service is the unit of work.** It calls `SaveChangesAsync`; repositories do not.
- Fluent mapping in `OnModelCreating`, no attributes. Enums as strings (`HasConversion<string>().HasMaxLength(20)`). `numeric(10,2)` for prices.
- Migrations are applied at startup with `db.Database.Migrate()`.
- Audit table `<Entity>Event(entityId, type, jsonPayload)` stores the payload actually published or received.
- Paging: `PagedRequest` / `PagedResult`, `LongCountAsync` plus `Skip/Take`.
- Drizzle (TypeScript): tables declared in `schema/*.ts` with `pgTable`, one repository class per aggregate wrapping the Drizzle client, `drizzle-kit` migrations applied at startup. Money in integer cents. Pin the exact Drizzle version.
- Document store (alternative): schema classes with indexes after; repositories use `Promise.all([find, countDocuments])` and a `compact({...})` helper to drop undefined filter keys. Without a migration tool, schema fixes are idempotent `onModuleInit` code wrapped in try/catch with a warning.
- State changes go through one state machine that writes an event row per transition.

## Configuration
- Precedence: code default (`?? "localhost"`), then `appsettings.json` (secrets blank), then environment variables `Section__Key` from compose or Helm.
- TypeScript: `configuration.ts` exports an `AppConfig` interface plus a factory (`process.env.X ?? 'default'`), read through `ConfigService<AppConfig, true>`. `env.validation.ts` marks only truly required variables, with messages like "X must be set - the app cannot ...".
- Compose: `${VAR:?VAR must be set}` for required values, `${VAR:-default}` for optional ones.
- `.env` is git-ignored; `.env.example` is committed, grouped by `# --- Section ---` headers with one-line comments.
- The connection string is built from parts; only the password is a secret.
- Seed users and data from config, idempotently, and publish the matching event.
- The Dockerfile bakes `build-info.json` (commit, UTC time); `/version` serves it.
- Never commit credentials in `appsettings.json` or anywhere else.
