# 10 - Comments, docs, commits

## Comments
- Explain **why** and the invariant, never what. Use `//` for decisions; use `///` or `/** */` on shared types and non-obvious fields (units such as "Integer cents.", legacy status).
- Long comments only where a mistake is likely: race conditions, queue-name collisions, filtered unique indexes, timezone arithmetic.
- Cite the decision: `see DECISIONS.md 21`, `spec section 8`.
- Plain CRUD gets none. No TODO or FIXME: open items go to a risks section in the docs.
- Direct, full sentences, in English.

## Docs
- A documentation area holds the spec:
  - `instructions.md`: numbered sections; event names and payloads are fixed here.
  - `notes.md` / `DECISIONS.md`: the append-only decision log.
  - `bdd.md`: Gherkin scenarios.
  - `architecture/`, `getting-started/`, `test-coverage/`, `diagrams/` (Mermaid).
- Per-service README, in this order: purpose in one line, run standalone, run as part of the system, what's here, routes (method, path, notes, required permission), lifecycle, env, test, documentation links. Error codes are listed inline in backticks.
- Docs are updated in the same commit as the code.
- Narrative docs may be bilingual: a `README.md` landing page plus `.en-US.md` and `.pt-BR.md`. Spec files stay English-only.
- A "Known gotchas" section when the setup has traps. Known tech debt gets a "Planned fix (not yet implemented)" callout.

## Decision log
Numbered and append-only. Each entry has:
- **Context** - what forced a choice.
- **Decision** - what was chosen.
- **Alternatives rejected** - and why not.
- **Why** - the reasoning.
- **Revisit if** - the condition that reopens it.
- Optionally **Verified live** - what was actually run to confirm.

Entries cite code paths and other entries by number. The entry count is never repeated as a literal elsewhere.

## Commits
- Conventional Commits with an optional scope, lowercase, and a full-sentence subject: `fix(orders): a payment that already succeeded is never retried`.
- Work on `feat/*` branches, merged by pull request.
- English subjects.

## Agent instructions file
Hard rules live in a short `CLAUDE.md`-style file (layering, idempotent consumers, k8s rules, verification bar) and link to the spec for everything else.
