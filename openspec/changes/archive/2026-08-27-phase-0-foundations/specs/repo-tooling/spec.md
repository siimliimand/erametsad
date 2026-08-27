## ADDED Requirements

### Requirement: Monorepo workspace
The project SHALL be a pnpm workspace with Turborepo. It SHALL contain a
single Next.js 15 (App Router) app at `apps/platform` embedding Payload CMS
3 with the Postgres adapter.

#### Scenario: Workspace scaffolds
- **WHEN** a developer runs `pnpm install` at the repo root
- **THEN** the workspace installs all apps and packages and the
  `apps/platform` dev server starts

### Requirement: Shared packages
The repo SHALL define the packages `ui`, `types`, `config`, and `emails`.
Each package SHALL be wired as an importable workspace package.

#### Scenario: Packages resolve
- **WHEN** `apps/platform` imports from `@eametsad/config`
- **THEN** the import resolves without a relative path

### Requirement: Lint and type config
The repo SHALL enforce ESLint, Prettier, and strict TypeScript via
`packages/config`. The config SHALL be applied to all apps and packages.

#### Scenario: Config enforced
- **WHEN** CI runs lint and typecheck
- **THEN** violations fail the build using the shared config, not per-file
  ad-hoc configurations

### Requirement: Local dev services
The repo SHALL provide a docker-compose config for postgres 16, redis 7, and
Mailpit SMTP. A `.env.example` file SHALL exist with zod-validated
environment loading.

#### Scenario: Dev environment boots
- **WHEN** a developer runs docker-compose up and starts the app
- **THEN** the app connects to local Postgres and Redis and environment
  variables validate at startup

### Requirement: CI pipeline
The repo SHALL run typecheck, lint, build, and unit tests on every pull
request.

#### Scenario: PR validation
- **WHEN** a pull request opens
- **THEN** CI runs typecheck, lint, build, and unit tests and reports pass
  or failure

### Requirement: Logging conventions
The app SHALL use a shared logger with request-id propagation and an
error-boundary convention.

#### Scenario: Request tracing
- **WHEN** a request is handled
- **THEN** a request-id is generated and every log line for that request
  carries the id
