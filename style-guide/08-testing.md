# 08 - Testing

## .NET
- `tests/<Org>.<Svc>.Tests/`: one project referencing the Api project, flat files named `<Subject>Tests.cs`.
- xUnit and NSubstitute, `<Using Include="Xunit" />`, coverlet. No FluentAssertions, no AutoFixture.
- Names are `Method_WhenCondition_ExpectedOutcome`, e.g. `CreateAsync_WhenGameDoesNotExist_ReturnsNotFoundAndDoesNotPublish`.
- `_sut` is built in the constructor from `Substitute.For<>` fields. Plain `Assert.*`, no Arrange/Act/Assert comments. Verify with `Received(1)` and `DidNotReceive()`.
- Consumers are tested by mocking `ConsumeContext<T>`.
- Hand-rolled fakes beat mocking packages for HTTP: a `FakeHttpMessageHandler` under `TestSupport/`.
- Test the domain directly (state machines, no-op after settle) and the validators.
- Coverage is measured and recorded in the docs.
- Optionally tag tests `[Trait("Category","Unit")]` / `Integration` and run CI with `--filter "Category!=Integration"`.
- **Architecture-guard tests** scan the registered `RouteEndpoint`s and assert that every route requires authorization.

## TypeScript
- Vitest, specs next to the source, plain-sentence titles ("only an admin may skip the rules").
- A hand-rolled builder instead of testing-module scaffolding:
  ```ts
  function build(current: any = null) {
    const repository = { findById: vi.fn() };
    return { service: new OrdersService(repository as any) };
  }
  ```
- Clients are tested with `vi.stubGlobal('fetch', vi.fn())`.
- Pure `domain/` modules get their own specs. Seed and catalog invariants are tested too ("keys are resource:action").
- End-to-end checks are a script against a plain mock server, not a unit-test suite.

## Standard to hold myself to
At least one integration test per service where time allows (a real Postgres via Testcontainers). If it is skipped, `DECISIONS.md` says so.
