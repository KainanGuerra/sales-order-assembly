# 02 - Service template

## .NET - one project per service, layers as folders

```
<svc>-api/
  src/<Org>.<Svc>.Api/
    Program.cs  appsettings.json  appsettings.Development.json  Dockerfile  *.csproj
    Domain/                 entities, enums, <Entity>Event (audit row)
    Application/
      Abstractions/         I<Entity>Service, I<Entity>Repository, I<External>Client
      Services/             <Entity>Service (sealed)
      Dtos/                 <Entity>Dtos.cs  (sealed records with FromDomain())
      Validators/           <Request>Validator.cs
    Infrastructure/
      Persistence/          <Svc>DbContext, <Entity>Repository, Migrations/
      Messaging/            consumers, outbox wiring
      Http/ Gateways/ BackgroundServices/      (only where needed)
    Endpoints/              <Entity>Endpoints.cs  (static, Map<Entity>Endpoints)
    Contracts/              event records, shared namespace
    Shared/Kernel/          Results, Entities, Repositories, Pagination
    Shared/Infrastructure/  Auth, Extensions, ErrorHandling, Settings, BuildInfo
  tests/<Org>.<Svc>.Tests/
  k8s/  postgres-init/  docker-compose.yml  .env.example  .github/workflows/ci.yml
```

### Program.cs order (flat top-level statements)
1. Serilog bootstrap logger, `CreateBuilder`, `UseSerilog` (compact JSON).
2. Postgres connection string built from parts (`Postgres:Host/Port/Database/Username/Password/SearchPath`).
3. `AddDbContext`, `AddJwtAuthentication`, `AddGlobalExceptionHandling`.
4. Repositories and services as `AddScoped`; `AddValidatorsFromAssemblyContaining`.
5. `AddMassTransit` with explicit receive-endpoint names, Swagger with a Bearer scheme, `AddHealthChecks`.
6. `Build`, `db.Database.Migrate()` in a scope, middleware, `/health`, `/version`, `Map<X>Endpoints`.
7. `try { app.Run(); } finally { Log.CloseAndFlush(); }` and `public partial class Program;`.

### C# idioms
- `sealed` by default: services, repositories, records, validators. Entities stay plain `public class` for EF.
- File-scoped namespaces, `Nullable` and `ImplicitUsings` on, explicit constructors (no primary constructors), `_camelCase` fields.
- `Async` suffix; `CancellationToken cancellationToken = default` last.
- No AutoMapper, no MediatR. DTOs expose `static FromDomain(entity)`.
- Endpoints are lambda handlers with one parameter per line; the validator is called explicitly.
- `AddScoped` for services; never mix lifetimes without a reason.

## TypeScript / NestJS

```
src/main.ts  app.module.ts
src/config/{configuration.ts, env.validation.ts, database/, logging/}
src/integrations/{http.ts, upstream.error.ts, <peer>/<peer>.client.ts}
src/modules/<name>/{controllers/, services/, repository/, schema/, dto/, [domain/ jobs/]}
src/shared/{decorators, dto, filters, guards, interceptors, logging, utils}
```
Specs sit next to the source (`*.spec.ts`).

`main.ts` order: pino logger, shutdown hooks, CORS (expose `x-request-id`), global `ValidationPipe({ whitelist, transform, forbidNonWhitelisted })`, `TransformInterceptor`, global `@Catch()` filter, `logEvent('Bootstrap', 'app.boot')`.

## Modular monolith variant
When one deployable is enough: `src/Modules/<Mod>/{Domain,Application,Infrastructure,Endpoints/v1,<Mod>Module.cs}` with an `IModule.RegisterServices` contract and a `Map<Mod>Module(this WebApplication)` extension. Modules never reach into each other's internals; any exception is documented.
