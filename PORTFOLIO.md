# BudgetBeacon Portfolio Notes

## Why This Project Exists

BudgetBeacon was built to demonstrate a realistic full-stack finance workflow: authenticated users can import or create transactions, review spending patterns, and request AI-assisted saving suggestions from aggregated financial context.

It is intentionally scoped as a maintainable product slice rather than a broad mockup. The goal is to show production-oriented engineering judgment: clear boundaries, typed APIs, validation, secure defaults, and useful UI states.

## Technical Decisions

- ASP.NET Core and EF Core provide a strongly typed backend with PostgreSQL persistence.
- A Clean Architecture-inspired split keeps Core independent from API and Infrastructure concerns.
- ASP.NET Identity cookie sessions avoid storing bearer tokens in browser storage.
- CSRF tokens protect unsafe requests from the React SPA.
- TanStack Query owns server state, caching, invalidation, and loading/error transitions.
- Material UI provides accessible primitives and consistent responsive behavior.
- AI calls stay on the backend so provider keys never reach the frontend.
- Imported transaction descriptions can be redacted before AI processing to reduce unnecessary sensitive context.

## Challenges Solved

- User data isolation across transaction routes and repository calls.
- CSV/XLSX import with preview, mapping, duplicate detection, and file validation.
- Consistent API problem details for validation, auth, not found, and external service failures.
- Mobile-friendly transaction browsing without forcing a desktop data grid onto small screens.
- AI tips presented as suggestions, not financial advice.
- Health and readiness checks that separate process liveness from database/provider readiness.

## Features Worth Showing

- Register/login flow and session restoration.
- Import [docs/demo-transactions.csv](docs/demo-transactions.csv), then review the dashboard.
- Filter, sort, paginate, edit, and delete transactions on desktop and mobile.
- Statistics page with category summaries and monthly trend views.
- AI tips page with timeframe filters, fallback states, and reasoning detail pages.
- Settings for AI location context and transaction import redaction rules.
- `/health/live`, `/health/ready`, and Swagger in development.

## What I Would Improve Next

- Add frontend component tests and a Playwright smoke test for the demo flow.
- Add rate limits and quotas around AI categorization and tips endpoints.
- Add password reset, email confirmation, and account deletion.
- Add production Dockerfiles and a repeatable staging deployment.
- Add dashboard screenshots and a short demo video to the README.
- Add monitoring dashboards and alert rules for API/database/AI failures.
