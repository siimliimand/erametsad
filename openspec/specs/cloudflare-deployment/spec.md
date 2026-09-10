# cloudflare-deployment Specification

## Purpose
TBD - created by archiving change option-b-cloudflare-only. Update Purpose after archive.
## Requirements
### Requirement: next-on-pages build
The app SHALL build and run via `@cloudflare/next-on-pages`. Pages Functions
SHALL handle API routes and SSE streams.

#### Scenario: API routes on Workers
- **WHEN** a request hits an API route in the Cloudflare deployment
- **THEN** the route runs on Workers and an SSE stream stays open

### Requirement: Queue and cache
The app SHALL dispatch background jobs through Cloudflare Queues and
SHALL use KV for ephemeral cache and feature flags. SSE broadcast SHALL
run through Durable Objects, not KV. The interface SHALL be common with
local BullMQ/Redis.

#### Scenario: Job dispatch
- **WHEN** a domain event enqueues a job
- **THEN** the job runs on Cloudflare Queues in production and on BullMQ
  locally

### Requirement: R2 media storage
The app SHALL store media uploads in an R2 bucket with signed URLs in
production.

#### Scenario: Media upload
- **WHEN** a file uploads in production
- **THEN** the file is stored in R2 and served via a signed URL

### Requirement: Wrangler bindings
The app SHALL declare environment bindings (D1 `DB`, Durable Objects,
Queues, KV, R2, `send_email`) in `wrangler.jsonc`. The KV binding SHALL
use the provisioned namespace id. A `/health` route SHALL exist for smoke
checks.

#### Scenario: Health check
- **WHEN** a deploy completes
- **THEN** `/health` returns success and the bindings resolve

### Requirement: Host-based area routing

The platform Worker SHALL map request hostnames to areas: requests to
`oksjonid.erametsad.ww0.dev` SHALL serve the `(portal)` route group, and
requests to the default hostname SHALL serve the `(marketing)` route group
plus `/admin` and `/styleguide`. On the default host, `/` SHALL rewrite to
the real route `/avaleht` and `/lepingud` SHALL rewrite to
`/lepingud/dokumendid`; on the portal host those two paths SHALL keep
serving the portal. Marketing-only paths, including `/paringud` and
`/paringud/*`, SHALL 308 to the default host when requested on the portal
host, and portal paths SHALL 308 to the portal host when requested on the
default host, preserving path and query. `/metsateatise-juhend` SHALL 301
to `/metsateatis`. Sessions SHALL work on both hostnames with host-only
cookies. No additional Worker SHALL be created; the mapping lives in
application middleware plus a Workers route or custom domain on the zone.
The admin hostname `admin.erametsad.ww0.dev` SHALL use the same mapping
table with a prefix-free URL space: the admin UI SHALL render at `/` and
at root paths (for example `/auctions`) through an internal rewrite into
the `/admin` route space, any `/admin`-prefixed URL SHALL 308 to the
clean form, the login and password flows SHALL stay same-host, and portal
and marketing paths SHALL 308 to their hosts. The `api.` hostname SHALL
serve only `/api` routes on the same Worker and SHALL 308 every other path
to the default host. Browser API calls SHALL target the api. hostname: the
deploy build SHALL set `NEXT_PUBLIC_API_ORIGIN`, the middleware SHALL
answer credentialed CORS only for origins under the allowlisted domain
suffixes, and the Worker SHALL carry `SESSION_COOKIE_DOMAIN` so session
cookies set by the API host reach the page hosts. Hosts outside the
suffix SHALL keep host-only cookies.

#### Scenario: Marketing hostname serves the homepage

- **WHEN** a browser requests `https://erametsad.ww0.dev/`
- **THEN** the homepage renders from `/avaleht` through the rewrite and
  the URL stays `/`

#### Scenario: Lepingud resolves per host

- **WHEN** a visitor requests `/lepingud` on the default host
- **THEN** the marketing document list renders
- **WHEN** an authed user requests `/lepingud` on the portal host
- **THEN** the portal contract signing list renders

#### Scenario: Wrong-host marketing path redirects

- **WHEN** a client requests `/kontakt` on the portal hostname
- **THEN** the middleware responds with a 308 to the same path on the
  default hostname

#### Scenario: Paringud path redirects from the portal host

- **WHEN** a client requests `/paringud/hooldusraie` on the portal hostname
- **THEN** the middleware responds with a 308 to the same path on the
  default hostname

#### Scenario: Portal hostname unchanged

- **WHEN** a browser requests `https://oksjonid.erametsad.ww0.dev/`
- **THEN** the listing renders from the portal route group as before

#### Scenario: Admin hostname lands on the admin UI

- **WHEN** a browser requests `https://admin.erametsad.ww0.dev/`
- **THEN** the workspace renders through an internal rewrite to
  `/admin` and the URL stays `/`

#### Scenario: Admin hostname keeps URLs prefix-free

- **WHEN** a browser requests `https://admin.erametsad.ww0.dev/admin/auctions`
- **THEN** the middleware responds with a 308 to `/auctions` on the same
  hostname, preserving the query

#### Scenario: Admin hostname keeps the login flow same-host

- **WHEN** an operator requests `/login` on the admin hostname
- **THEN** the middleware serves it without redirecting, so the session
  cookie is set on that hostname

#### Scenario: API host serves only the API

- **WHEN** a browser requests `https://api.erametsad.ww0.dev/admin`
- **THEN** the middleware responds with a 308 to
  `https://erametsad.ww0.dev/admin`

#### Scenario: API host answers credentialed CORS for same-site origins

- **WHEN** the admin page origin calls the api. host with credentials
- **THEN** the response carries the caller's origin in
  `Access-Control-Allow-Origin` with
  `Access-Control-Allow-Credentials: true`, and a foreign origin receives
  no CORS headers

### Requirement: Deploy CI
CI SHALL deploy a preview via `wrangler` on pull requests. CI SHALL deploy
to production on merge to main. (Should-priority.)

#### Scenario: Preview deploy
- **WHEN** a pull request opens
- **THEN** a Cloudflare preview deployment runs and returns a linkable URL

