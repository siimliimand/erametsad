# cloudflare-deployment

## MODIFIED Requirements

### Requirement: Host-based area routing

The platform Worker SHALL map request hostnames to areas: requests to
`oksjonid.erametsad.ww0.dev` SHALL serve the `(portal)` route group, and
requests to the default hostname SHALL serve the `(marketing)` route group
plus `/admin` and `/styleguide`. On the default host, `/` SHALL rewrite to
the real route `/avaleht` and `/lepingud` SHALL rewrite to
`/lepingud/dokumendid`; on the portal host those two paths SHALL keep
serving the portal. Marketing-only paths SHALL 308 to the default host
when requested on the portal host, and portal paths SHALL 308 to the
portal host when requested on the default host, preserving path and query.
`/metsateatise-juhend` SHALL 301 to `/metsateatis`. Sessions SHALL work on
both hostnames with host-only cookies. No additional Worker SHALL be
created; the mapping lives in application middleware plus a Workers route
or custom domain on the zone. The `api.` and `admin.` hostnames SHALL use
the same mapping table when introduced.

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

#### Scenario: Portal hostname unchanged

- **WHEN** a browser requests `https://oksjonid.erametsad.ww0.dev/`
- **THEN** the listing renders from the portal route group as before
