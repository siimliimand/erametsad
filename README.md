# Erametsad

Erametsad is an Estonian forest transaction platform. Forest owners sell
cutting rights and forest property by auction. Vetted buyers bid on them.

## Prerequisites

- **Node.js** 22 or later
- **pnpm** 9.15 (use `corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- **Docker** and Docker Compose (for local Postgres, Redis, Mailpit)

## Quick start

```bash
pnpm install
docker compose up -d
cp .env.example .env
pnpm dev
```

The app starts at `http://localhost:3000`.

## Environment setup

Copy `.env.example` to `.env` at the repo root. The default values connect to
the local Docker services. Change `PAYLOAD_SECRET` to a random string at least
32 characters long in production.

## Available scripts

| Command           | Purpose                          |
|-------------------|----------------------------------|
| `pnpm dev`        | Start all dev servers             |
| `pnpm build`      | Build all apps and packages       |
| `pnpm lint`       | Run lint across the workspace     |
| `pnpm typecheck`  | Run TypeScript type checking      |
| `pnpm test`       | Run all tests                     |

## Project structure

```
erametsad/
├── apps/
│   └── platform/         Next.js 15 app with Payload CMS 3
├── packages/
│   ├── config/           Shared ESLint, Prettier, TypeScript config
│   ├── emails/           Email templates
│   ├── types/            Shared TypeScript types
│   └── ui/               Shared React components with Tailwind
├── docker-compose.yml    Postgres 16, Redis 7, Mailpit
├── .env.example          Environment variable template
├── pnpm-workspace.yaml   pnpm workspace definition
└── turbo.json            Turborepo task configuration
```

## Architecture

The project is a pnpm monorepo with Turborepo. The single app at
`apps/platform` hosts the marketing site, the auction portal, and the admin
panel. Payload CMS 3 provides the API, admin interface, and content
management. It embeds directly into Next.js 15 (App Router).

**Key technologies:**
- Next.js 15 with App Router (SSG, ISR, API routes)
- Payload CMS 3 with Postgres adapter
- PostgreSQL 16 (primary store)
- Redis 7 (session cache, BullMQ, SSE pub/sub)
- React 19, TypeScript, Tailwind CSS

**Deployment targets:** Cloudflare (Workers, Pages, D1, R2, Queues) per the
cloudflare-deployment spec.

## Local development services

| Service    | Image                | Ports           |
|------------|----------------------|-----------------|
| PostgreSQL | postgres:16          | 5432            |
| Redis      | redis:7-alpine       | 6379            |
| Mailpit    | axllent/mailpit      | 1025 (SMTP)     |
|            |                      | 8025 (Web UI)   |

Mailpit captures all outgoing email in development. Open
`http://localhost:8025` to view messages.

## Database

```bash
# Apply Payload migrations
pnpm --filter @erametsad/platform run payload migrate

# Reset local database (drop and re-create)
docker compose down -v && docker compose up -d
```

## Demo accounts

The Payload admin panel is at `http://localhost:3000/admin`. In development,
create a user through the registration flow or seed script (see Payload
foundation spec for seed data details).

## Demo eID login

Without aggregator credentials (`EIDEASY_CLIENT_ID` and `EIDEASY_SECRET`), the
login page uses a demo eID simulator instead of the eID Easy service. The
simulator accepts the isikukood of any seeded user, for example `10000000002`
(see `apps/platform/src/lib/data/seed/users.ts`).

Start a session, then poll until it completes. The simulator completes on the
second poll, so accept the control code twice.

`EID_DEMO_ISIKUKOOD` holds a comma-separated list of extra demo identities.
These work even on an empty database, before you run the seed script.
Defaults: `38803160272`, `47012130215`, `60001010205`.