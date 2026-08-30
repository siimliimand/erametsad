## ADDED Requirements

### Requirement: Host-based area routing
The platform Worker SHALL map request hostnames to areas: requests to
`oksjonid.erametsad.ww0.dev` SHALL serve the `(portal)` route group, and
the default hostname SHALL keep its current behavior. Requests to portal
routes or app routes on the wrong host SHALL redirect to the mapped host,
preserving path and query. Sessions SHALL work on both hostnames with
host-only cookies. No additional Worker SHALL be created for the portal
area; the mapping lives in application middleware plus a Workers route or
custom domain on the zone. The `api.` and `admin.` hostnames SHALL use
the same mapping table when introduced.

#### Scenario: Portal hostname serves the portal
- **WHEN** a browser requests `https://oksjonid.erametsad.ww0.dev/`
- **THEN** the listing renders and the response comes from the existing
  platform Worker

#### Scenario: Wrong host redirects
- **WHEN** a client requests a portal route on the default hostname
- **THEN** the middleware redirects to the same path on the portal
  hostname

#### Scenario: Session works on both hostnames
- **WHEN** a user logs in on the default hostname and visits the portal
  hostname
- **THEN** each hostname keeps its own independent session without
  errors
