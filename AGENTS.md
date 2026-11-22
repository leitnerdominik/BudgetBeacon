# BudgetBeacon agent instructions

## Scope and working agreements

- This guide applies across checkouts. Optional local agent configuration lives in `.codex/`, which Git ignores.
- Keep work within the user's request. Preserve existing user changes, staged files, and unrelated code. Do not commit, push, deploy, or apply database migrations without an explicit request.
- The primary agent owns implementation decisions, integration, verification, and final acceptance. Prefer the smallest coherent change using existing conventions; do not rewrite the architecture or add dependencies without separate authorization.
- Inspect the relevant code path and applicable instructions first. Expand investigation only when evidence requires it. Use `rg` for targeted searches; avoid reading a full repository map for a small edit.
- Ask a focused question when the answer would materially change the result. Otherwise make routine choices and complete authorized work through verification. Do not request approval again when the same action is already authorized.

## Risk and planning

Classify changes by their actual impact:

- **Trivial:** isolated, obvious, low-impact edits. Proceed directly with proportionate verification.
- **Standard:** contained behavior changes with understood interfaces. Briefly state the approach, implement, and verify.
- **Risky:** persistence, authorization, concurrency, migrations, shared/public contracts, core financial rules, multiple subsystems, destructive behavior, or substantial refactors. Inspect first, present scope, invariants, approach, and verification, then obtain approval before editing unless that plan is already approved.

This approval boundary is a project policy. Read-only investigation and preparation of a concrete proposal can proceed before approval. Seek separate authorization for a specific dependency or architecture change. Reclassify when investigation reveals additional risk.

## Repository map and current stack

BudgetBeacon tracks transactions, imports bank exports, summarizes financial activity, and offers AI-assisted categorization and saving tips.

```text
budgetbeacon-back/
  BudgetBeacon.sln
  BudgetBeacon.Api/             Controllers, auth, DI, middleware, health checks
  BudgetBeacon.Core/            Entities, models, interfaces, financial services
  BudgetBeacon.Infrastructure/  EF Core, PostgreSQL, repositories, import/external clients
  BudgetBeacon.Tests/           xUnit tests
budgetbeacon-front/
  src/api/                     Typed clients and shared HTTP behavior
  src/features/                Feature components, hooks, and utilities
  src/components/              Reusable UI and layout
  src/pages/                   Route-level composition
  src/hooks/                   Shared hooks
  src/lib/                     App integrations
  src/theme/                   Material UI theme
  src/types/                   Shared types
  src/utils/                   Small pure helpers
  tests/                       Node test-runner tests
```

- Backend: .NET 9 / ASP.NET Core, ASP.NET Identity cookie authentication, CSRF protection, EF Core, PostgreSQL.
- Frontend: React 19, strict TypeScript, Vite, Material UI, TanStack Query, React Router, Axios.
- AI: backend-only DeepSeek implementation behind `IAiAdvisorService`. Auth0 and OpenRouter are not the current integrations; introducing them requires an explicit task.
- Read `README.md` for setup and `.github/workflows/ci.yml` for CI commands when those topics matter. Verify manifests and current code if documentation disagrees; report the discrepancy.

## Backend boundaries

Allowed dependency direction: `Api -> Core`, `Api -> Infrastructure`, `Infrastructure -> Core`, `Tests -> Api/Core/Infrastructure`.

- Core must remain independent of Api and Infrastructure. Keep domain rules, financial calculations, validation, and infrastructure interfaces in Core; exclude EF Core, PostgreSQL, identity-provider, and AI-provider implementation details.
- Keep controllers focused on HTTP validation, mapping, and delegation. Do not add direct DbContext access, provider calls, or financial calculations to controllers. Existing design gaps do not authorize unrelated refactoring.
- Put repositories, EF configurations and migrations in `BudgetBeacon.Infrastructure/Data`; external clients and import parsing implementations in `BudgetBeacon.Infrastructure/External`.
- Keep API configuration, authentication, authorization policies, middleware, and composition-root wiring in Api. Prefer a current-user abstraction when the authorized change warrants it; do not scatter new claim parsing.
- Use async database/external calls and propagate `CancellationToken` where supported. Validate payloads; preserve routes, DTOs, status codes, and consistent problem responses unless the task explicitly changes them.

## Financial and persistence invariants

- Use `decimal` for backend money with explicit storage precision, scale, and rounding. Preserve transaction sign, treatment, category, refund, and import semantics; inspect the existing validators and aggregation services before changing them.
- The backend is authoritative for critical financial calculations. Frontend formatting must not change stored numeric values; avoid duplicating domain calculations in display helpers.
- Keep summaries deterministic. Define date-range boundaries, month/year transitions, UTC versus local timestamps, and calendar dates explicitly; avoid timezone conversion that shifts a transaction's calendar date.
- Validate zero, negative, large, and fractional amounts intentionally. Test relevant empty-data, income-only, expense-only, refund, recurring, deleted-category, currency, rounding, and date-boundary cases.
- Scope persistence queries to the current user. Preserve atomicity and import deduplication. Review schema changes and generated migrations before proposing application; never apply them as a verification shortcut.
- Add user/date/category indexes when justified by the requested query change. Do not store derived summaries without an approved reason and a deterministic update strategy.

## Authentication, security, and privacy

- Resolve identity from server-side authenticated claims. Never trust a client-supplied owner ID; verify ownership for reads, updates, deletes, imports, preferences, categorization, and tips.
- Preserve Identity session cookies, backend authorization, CSRF validation, allowed origins, and frontend credential handling. UI route guards provide user experience; the backend enforces access.
- The shared frontend HTTP client is `budgetbeacon-front/src/api/httpClient.ts`; preserve its credential, CSRF, and error behavior. Do not introduce an alternative auth/token mechanism incidentally.
- Keep credentials in environment variables, user secrets, or platform secret management. Frontend `VITE_` values are public. Never expose database credentials, AI keys, auth secrets, or tokens in code, bundles, logs, commits, or reports.
- Do not log sensitive transaction descriptions, financial payloads, or AI prompts/responses containing private data. Return safe errors without stack traces or internal exception details.
- Preserve import file-size/type validation and payload limits. Treat imported descriptions and provider output as untrusted data.

## AI behavior

- Keep DeepSeek HTTP implementation in Infrastructure behind the Core interface. Do not call the provider from the frontend or build prompts in controllers/UI components.
- Send the minimum necessary context. Prefer financial aggregates for tips; categorization may require transaction descriptions, so preserve applicable redaction and payload limits. Avoid unnecessary personal information.
- Validate and constrain generated categories and tips before use. Handle malformed output, partial batch failures, cancellation, and provider outages with predictable fallback/error states.
- Label suggestions as AI-generated, ground them in the financial summary, and avoid presenting them as professional financial advice or guaranteed outcomes. Use practical, nonjudgmental language.

## Frontend boundaries and behavior

- Use functional React components and strict TypeScript; avoid `any`, suppressed errors, and mixed-responsibility files.
- Keep backend communication typed and centralized in `src/api` or an established feature API module. Use the shared HTTP client; components and pages should not perform ad hoc requests.
- Keep feature-specific components, query hooks, forms, types, and utilities in `src/features`. Pages compose screens; reusable UI belongs in `src/components`. Shared hooks/types/helpers must have actual cross-feature use.
- Use TanStack Query for server state with stable keys and deliberate invalidation/update after mutations. Keep local UI state local; avoid duplicating server state or adding hidden event-bus side effects.
- Keep route definitions in `src/router.tsx`, bootstrapping in `src/main.tsx`, and root composition in `src/App.tsx`. Preserve protected-route behavior.
- Use Material UI and existing theme tokens. Keep currency/date formatting consistent, form labels accessible, destructive actions explicit, and financial values easy to distinguish.
- Handle loading, empty, success, error, slow-network, offline, and unavailable-AI states where applicable. Check responsive layouts and keyboard interactions for changed UI.

## Verification

Choose checks according to the changed surface. Add meaningful behavior coverage for domain, authorization, validation, API, mutation, or interaction changes; do not add tests that merely repeat implementation. Documentation-only edits need content, path, command, and diff checks rather than application builds.

Backend code changes, from `budgetbeacon-back`:

```bash
dotnet restore BudgetBeacon.sln
dotnet build BudgetBeacon.sln --configuration Release --no-restore
dotnet test BudgetBeacon.sln --configuration Release --no-build
```

Frontend code changes, from `budgetbeacon-front`:

```bash
npm run lint
npm test
npm run build
```

- Use Node.js 24 to match CI and support the current direct TypeScript tests. Use `npm ci` with the committed lockfile when dependencies need installation; do not reinstall for every task.
- Run `npm test` locally for frontend code changes. The frontend job in `.github/workflows/ci.yml` runs lint and build.
- There is no `typecheck` script. `npm run build` includes `tsc -b`; use `./node_modules/.bin/tsc -b` for a focused TypeScript check when needed.
- Start with relevant tests while iterating, then complete the required checks above for the affected application. Rerun checks affected by fixes; broaden/repeat only when failures, new edits, or unresolved concerns justify it.
- The existing frontend Node tests cover utilities and state behavior; they do not establish live component rendering. For UI changes, inspect the affected flow in a browser when available and distinguish live checks from static/automated evidence.
- The API applies pending EF Core migrations to its configured PostgreSQL database on startup. When live verification requires starting the API, point it at a disposable PostgreSQL database and obtain explicit authorization for migrations unless already granted.
- Do not weaken tests, suppress errors, or change unrelated code to obtain a pass. Report failing commands and whether the cause is pre-existing, task-related, or environmental. State what remains unverified.

## Independent review

- For risky code changes, request independent read-only assessments after initial verification when review tools are available. The Reviewer checks defects and regressions. The Tester assesses coverage, failure cases, and verification evidence. Use the local named roles when configured or equivalent read-only reviewers. Report any assessment that could not be obtained.
- Give both reviewers the same stable patch, scope, acceptance criteria, and check results. Limit delegation to two active children and one level. Close finished children. The primary agent owns integration, tests, and final acceptance.
- Delegate implementation only for bounded work with a clear benefit. Assign file ownership and an isolated worktree, and require preservation of concurrent edits.

## Code review and handoff

Prioritize defects affecting ownership, privacy, CSRF, money precision, date boundaries, import integrity, query invalidation, API compatibility, and failure handling. Flag actionable regressions with file/line evidence; keep formatting enforcement in lint/CI.

Before finishing, inspect the final diff for scope and unintended edits. Report the result concisely: changed files, behavior, checks actually run, and material limitations. Use plain language and avoid repetitive plans or speculative warnings. Never claim live UI, test, review, deployment, or model-selection success without evidence.

Include a concise suggested commit message in the final response after each task. Create a commit only when explicitly requested.
