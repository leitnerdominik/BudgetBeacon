# PTS Manager

PTS Manager is a full-stack personal finance application with a React frontend and an ASP.NET Core backend. Users can sign in, upload transaction CSV files, browse their transaction history, inspect monthly summaries, and fetch AI-generated savings tips.

## Repository layout

This workspace contains two projects:

- `ptsmanager`
  React 19 + TypeScript frontend built with Vite, Material UI and TanStack Query.
- `PTSManagerYC`
  ASP.NET Core Web API with a layered architecture, PostgreSQL persistence via EF Core, and Gemini integration for financial tips.

## Architecture overview

### Frontend

The frontend lives in `ptsmanager/src` and is feature-oriented:

- `features/auth`
  Login page, auth context, protected routing and login mutation.
- `features/dashboard`
  Summary cards, recent transactions and the "Tip of the Day" view.
- `features/transactions`
  Transaction list, CSV upload flow, monthly summary API access and mobile transaction cards.
- `features/tips`
  Tips page, cards and AI tips query hooks.
- `components`
  Shared layout, notifications, route errors and other reusable UI pieces.
- `lib`
  Axios API client and shared request plumbing.
- `theme`
  Material UI theme configuration.

Key frontend decisions:

- React Router handles `/login`, `/`, `/transactions` and `/tips`.
- TanStack Query owns server-state fetching, caching and invalidation.
- Material UI provides the design system and responsive layout behavior.
- Large routes are lazy-loaded to reduce the main production bundle.
- Mobile screens use dedicated responsive layouts, especially for transactions and drawer navigation.

### Backend

The backend follows a simple layered split inside `PTSManagerYC`:

- `PTSManagerYC.Api`
  HTTP controllers, startup configuration and runtime host.
- `PTSManagerYC.Core`
  Domain models, interfaces and business services.
- `PTSManagerYC.Infrastructure`
  EF Core data access, repository implementations, CSV import helpers and external AI integration.

Current backend entry points:

- `AuthController`
  Session-based authentication endpoints for CSRF, register, login, logout and current-user lookup.
- `TransactionsController`
  Transactions listing, CSV import, monthly summary and AI tips endpoints.

Key backend decisions:

- EF Core uses PostgreSQL via `FinzManagerDbContext`.
- Serilog writes API logs to console and rolling log files.
- Gemini is used for savings tip generation.
- Swagger is enabled in development.

## Local development

### Prerequisites

- Node.js 20+ and npm
- .NET 9 SDK
- PostgreSQL

### 1. Start the backend

From the workspace root:

Set the required values through environment variables. The keys are present in `appsettings.json`, but the secret values themselves must come from the environment.

PowerShell example:

```powershell
$env:ConnectionStrings__DefaultConnection="Host=localhost;Port=5432;Database=ptsmanageryc;Username=YOUR_USER;Password=YOUR_PASSWORD;SSL Mode=Disable"
$env:Gemini__ApiKey="YOUR_GEMINI_API_KEY"
```

If you have an older local database that was created before migrations were introduced, drop it once before starting the API. The application now applies EF Core migrations on startup and expects the schema to be migration-managed.

Then start the API:

```powershell
cd ptsmanager-back\PTSManagerYC.Api
dotnet run
```

By default, local development uses the profile from `Properties/launchSettings.json` and serves the API on `http://localhost:5078`.

### 2. Start the frontend

Open a second terminal:

```powershell
cd ptsmanager
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies `/api` requests to `http://localhost:5078`.

### 3. Open the app

Use:

- `http://localhost:5173`

### Local configuration notes

The backend currently reads:

- `ConnectionStrings:DefaultConnection`
- `Gemini:ApiKey`
- `Gemini:Model`

Checked-in config now contains the required keys again, but not the secret values. Provide the database connection string and Gemini API key through environment variables or secret management in deployed environments.

Important:

- the previously committed database password and Gemini API key should be rotated outside the repo
- local development now uses EF Core migrations; install local tools with `dotnet tool restore` if you need to add or update migrations

## Build and verification

### Frontend

```powershell
cd ptsmanager
npm run lint
npx tsc -b
npm run build
```

The production frontend output is written to:

- `ptsmanager/dist`

### Backend

```powershell
cd ptsmanager-back\PTSManagerYC.Api
dotnet build PTSManagerYC.Api.csproj -v minimal -p:UseAppHost=false
```

To produce a publishable backend build:

```powershell
cd PTSManagerYC\PTSManagerYC.Api
dotnet publish PTSManagerYC.Api.csproj -c Release -o .\publish
```

The publish output is written to:

- `PTSManagerYC/PTSManagerYC.Api/publish`

## Deployment overview

The application is not fully production-ready yet, but the intended deployment shape is:

1. Build the frontend and host `ptsmanager/dist` behind a static web server or reverse proxy.
2. Publish the backend API with `dotnet publish`.
3. Run the API behind HTTPS, typically behind a reverse proxy such as Nginx, IIS or a cloud ingress.
4. Point the frontend to the API base URL and configure backend CORS for the deployed frontend origin.
5. Provide secrets and connection strings through environment-specific secret storage, not checked-in JSON files.
6. Provision PostgreSQL and apply schema changes through proper migrations.

Before any real production release, these blockers should be addressed:

- remove committed secrets from source control
- add automated tests, health checks and deployment automation

## Mobile support

### Current expectations

The UI is designed for mobile web usage and currently supports:

- responsive app bar and drawer behavior
- compact dashboard cards on narrow screens
- a dedicated card-based transaction layout on mobile instead of the desktop data grid
- collapsible tip descriptions to reduce vertical scrolling
- touch-friendly pagination and upload interactions

The primary target is modern mobile browsers in responsive widths roughly between `320px` and `430px`.

### Current limitations

These limitations are important when planning release scope:

- this is a responsive web app, not a native iOS or Android app
- no PWA install/offline strategy is implemented yet
- cookie-based auth now requires CSRF protection for unsafe requests; the frontend handles this automatically
- CSV import depends on the browser file picker experience
- desktop and mobile layouts are both supported, but not every screen has dedicated offline/poor-network handling yet

## API surface used by the frontend

The frontend currently consumes these backend routes:

- `GET /api/auth/csrf`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/transactions`
- `POST /api/transactions/import`
- `GET /api/transactions/summary`
- `GET /api/transactions/ai/tips`

## Known production gaps

The main remaining release topics are tracked in:

- `../todo.txt`

Highlights:

- secrets management
- consistent loading/error UX
- CI/CD and deployment documentation

## Recommended workflow

For day-to-day development:

1. Start PostgreSQL.
2. Run `dotnet tool restore` once per clone if the EF tools are not installed yet.
3. Run the API via `dotnet run`.
4. Run the frontend via `npm run dev`.
5. Use `npx tsc -b`, `npm run build` and `dotnet build -p:UseAppHost=false` before handing changes off.

For release preparation:

1. Review `todo.txt`.
2. Build frontend and backend in release mode.
3. Validate the deployed frontend against the deployed API.
4. Smoke-test login, CSV import, transactions, dashboard refresh, tips, logout and mobile navigation.
