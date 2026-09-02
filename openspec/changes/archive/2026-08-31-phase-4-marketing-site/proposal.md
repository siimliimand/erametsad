# Proposal: phase-4-marketing-site

## Why

Phases 0-3 delivered the foundations, the design system, the full backend,
and the auction portal. The public face that starts the funnel does not
exist yet. A forest owner has no page to land on, no way to leave a lead,
and no content that explains the service. Demo story 1 ("forest owner
leaves a lead on the marketing site -> it lands in the admin Leads CRM")
is blocked on this phase. Phase 4 builds the marketing site (`erametsad.*`)
as a new `(marketing)` route group on top of the existing design system,
CMS repositories, and lead API.

## What Changes

- **Host routing**: the default hostname serves the marketing route group.
  The portal keeps the real `/` and `/lepingud` routes on its host. The
  default host gets them through middleware rewrites (`/` -> `/avaleht`,
  `/lepingud` -> `/lepingud/dokumendid`). Marketing-only paths on the
  portal host redirect to the default host, and the reverse.
- **Global shell**: sticky header (72px, dropdown menus, mobile Drawer
  accordions, skip link, CTA "Oksjonikeskkond"), 5-column footer, pre-footer
  ContactBand, non-modal CookieBanner with granular consent and
  `POST /api/v1/consent`, branded 404/500 pages.
- **Homepage**: hero with LeadForm, "Plaanis metsa müük?" band,
  AuctionTicker, team minis, trust statistics (hide on failure), 3-column
  process, latest articles, newsletter, testimonials, closing LeadForm.
- **Service pages**: Raieõiguse müük, Kinnistu müük (sealed-bid explainer),
  Metsa hindamine (SEO-article template), plus [S] Metsateatis,
  Hindamisaktid, Kiiroksjon.
- **Content pages**: KKK hub + 7 category pages with FAQPage JSON-LD, Meist
  + Metsaspetsialistid + 6 specialist profiles, Artiklid hub + article
  template, Kontakt, Lepingud document list.
- **Support APIs**: consent log, newsletter double opt-in, consent-gated
  analytics event skeleton [S]. Three small additive D1 tables.
- **Site-wide**: per-page metadata with canonical URLs, JSON-LD builders,
  `sitemap.xml` + `robots.txt`, ISR caching tiers (content 1h, ticker 60s
  client refresh, statistics 24h).

## Capabilities

### New Capabilities

- `marketing-shell`: marketing layout, header, footer, contact band,
  cookie consent, error pages.
- `marketing-home`: homepage composition, ticker freshness, statistics
  resilience, newsletter block.
- `marketing-services`: the six service pages, including the reusable
  SEO-article template.
- `marketing-content`: KKK, meist, specialist profiles, artiklid, kontakt,
  lepingud documents.
- `marketing-support-api`: consent, newsletter, and events endpoints with
  their tables.
- `marketing-seo`: metadata, structured data, sitemap/robots, caching
  tiers.

### Modified Capabilities

- `cloudflare-deployment`: the host-based area routing table gains the
  marketing area, two host-conditional rewrites, cross-host redirects for
  marketing-only paths, and one static 301. Portal routes are unchanged.

## Impact

- New route group `apps/platform/src/app/(marketing)/` with layout,
  `_components`, `_lib`, and page trees. No existing portal or admin route
  moves.
- `apps/platform/src/lib/routing/host-areas.ts` and `middleware.ts` gain
  the marketing area and rewrite rules; `middleware.test.ts` grows the new
  branches.
- Three new D1 tables through Drizzle Kit migrations: `consent_log`,
  `newsletter_subscribers`, `analytics_events`. All additive.
- New API routes under `apps/platform/src/app/api/v1/`: consent, newsletter
  (subscribe/confirm/unsubscribe), events.
- New `app/not-found.tsx`; `app/error.tsx` restyled with contact data.
- `packages/ui` is a consumer, not a target. Phase 1 already shipped every
  component this phase composes.
- No changes to the bidding engine, schema lifecycle, or SSE servers.

## Deferred (accepted in writing)

- Päringud hub + 3 request forms (`/paringud/*`) [S] - the
  `POST /api/service-requests` backend, routing engine, and partner
  directory stay deferred from phase 2. A form without a backend is a dead
  end.
- ~20 long-tail SEO instances of the Metsa hindamine template [L] - the
  template ships once; content production comes later.
- Real analytics provider (Plausible/GA4) [S] - only the consent-gated
  server event log skeleton ships.
- Metsaühistu subsite [L] (phase 5) - header and footer carry external
  links only.
- Newsletter digests [L]; EN/RU localization [L].

## Notes

- Only `fullstack-engineer` exists in `.opencode/agents/`, so every task is
  annotated with it. A marketing-frontend or content/SEO specialist would
  fit this phase; create one with `/make-engineer` if wanted.
