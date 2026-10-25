# 05 - Errors and validation

## Result pattern (.NET)
`Shared/Kernel/Results/Result.cs` in every service:
- `ErrorType { Validation, NotFound, Conflict, Unauthorized }` and `sealed record Error(Type, Message)` with factories such as `Error.NotFound(...)`.
- `Result` and `Result<T>`: `Result.Success(x)`, `Result.Failure<T>(Error.Conflict("..."))`.
- `result.ToHttpResult(onSuccess?)` maps to ProblemDetails with 400, 401, 404 or 409.

## Exceptions are for faults
- A `GlobalExceptionHandler : IExceptionHandler` logs the error and returns a 500 ProblemDetails with a `traceId`.
- Typed domain exceptions are fine where Result is not in use (a `DuplicateCodeException` translating a duplicate-key write error).
- NestJS: services throw Nest exceptions (`NotFoundException`, `ConflictException`, `ServiceUnavailableException`). Domain errors extend `ConflictException` with a code. There is no Result type in TypeScript.

## Races
A pre-flight check gives a friendly message; the **unique index is the real guard**. Catch `DbUpdateException when InnerException is PostgresException { SqlState: UniqueViolation }` and return `Error.Conflict`. Use partial unique indexes (`HasFilter`) for "one active per ..." rules.

## Validation
- .NET: FluentValidation, `sealed` validators, `RuleFor(...).NotEmpty().MaximumLength(n).WithMessage(...)`, called explicitly in the endpoint:
  ```csharp
  var validation = await validator.ValidateAsync(request, cancellationToken);
  if (!validation.IsValid) return Results.ValidationProblem(validation.ToDictionary());
  ```
  No endpoint filter, no MediatR.
- TypeScript: Zod schemas as DTOs, validated by Nest 12's built-in `StandardSchemaValidationPipe`; `z.coerce.number()` for query numbers. Domain rules stay in services, not DTOs. (class-validator is the alternative when Zod is not available.)
- The backend owns every business rule; the frontend only displays.

## Response shapes
- .NET: ProblemDetails for errors, DTO records for success.
- TypeScript: envelope `{ success: true, data }` or `{ success: false, error, traceId }`; lists are `{ items, total, page, pageSize }`.
- Pagination: `page=1`, `pageSize=25`, max 100. Repository signature takes `(filter, page, pageSize)`.
- Money: integer cents, or `numeric(10,2)`. Currency formatting happens only in the frontend.

## Retry rule
Retry only what is provably safe. Connection setup: yes (3 tries, short backoff). A write already sent to the server: never.
