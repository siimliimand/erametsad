# Design: phase-4-marketing-site

## Context

Phases 0-3 shipped the design system in `packages/ui` (LeadForm,
AuctionTicker, ContactBand, SpecialistCard, SearchableAccordion, StickyTOC,
MapEstonia, Testimonial, ArticleCard, ConsentCheck, FormFile), the D1 data
layer with repositories for pages, articles, FAQ, specialists,
testimonials, legal documents, and settings, seeded CMS content, the lead
endpoint, the statistics endpoint, and the portal route group that owns
`/` and `/lepingud`. Host routing lives in
`apps/platform/src/lib/routing/host-areas.ts`: the portal host serves the
portal, the default host serves `/admin` and `/styleguide` and redirects
everything else to the portal. Page-level truth is
`docs/design/00-global-shell.md` and `docs/design/marketing/01..17`.

## Goals / Non-Goals

**Goals:**

- Every marketing page reachable at its spec route on the default host.
- Portal routes and sessions behave exactly as shipped on the portal host.
- LeadForm submissions land in Leads CRM with source tracking
  (`<page-slug>-<n>` form names).
- Consent before analytics; every consent decision logged server-side.
- Content served from the CMS repositories that phase 2 seeded.

**Non-Goals:**

- Admin UI (phase 5).
- Päringud forms and the service-request backend (deferred, see proposal).
- Real analytics provider, long-tail SEO instances, metsaühistu subsite.
- Any change to the bidding engine, SSE servers, or portal pages.

## Decisions

### D1: `(marketing)` route group with two host-conditional rewrites

The marketing pages are real routes in
`apps/platform/src/app/(marketing)/`. Next.js allows one owner per path,
and the portal owns `/` and `/lepingud` (both are deep-linked across the
portal). The marketing homepage therefore lives at the real route
`/avaleht` and the document list at `/lepingud/dokumendid`. Middleware
rewrites `/` -> `/avaleht` and `/lepingud` -> `/lepingud/dokumendid` on
the default host only. The URL stays `/` and `/lepingud` for visitors and
crawlers.

Alternative: move the portal listing off `/`. Rejected: portal deep links
(ticker cards, footer, SSE handlers, bid-gate redirects) all target the
shipped portal paths.

### D2: Marketing-only paths redirect across hosts

The area table classifies `/teenused`, `/kkk`, `/meist`, `/artiklid`,
`/metsateatis`, `/hindamisaktid`, `/kiiroksjon`, `/kontakt` as marketing
paths. On the portal host they 308 to the default host. Portal paths
(`/oksjon`, `/ajalugu`, `/user`, `/login`, and the rest) on the default
host keep the existing 308 to the portal host. The rewrite targets
`/avaleht` and `/lepingud/dokumendid` redirect back to their canonical
forms (`/`, `/lepingud`). Shared prefixes (`/api`, `/_next`) and app
paths (`/admin`, `/styleguide`) stay untouched. `/metsateatise-juhend`
gets a static 301 to `/metsateatis`.

### D3: Server components read repositories; new REST only for consent, newsletter, events

CMS content renders in server components straight from the repositories,
like the portal does. New REST endpoints exist only where a browser client
submits something: consent, newsletter subscribe/confirm/unsubscribe, and
events. Ticker and statistics follow the page specs: server render plus
client refresh (ticker 60s) or ISR (statistics 24h).

### D4: One consent cookie, one server log

`erametsad_consent` (12 months) is the single client-side source of truth;
`use-consent.ts` reads it and gates analytics loading and `track()`. Every
decision POSTs to `/api/v1/consent`, which appends to `consent_log` with a
salted ip_hash. The `cookie_consent` event posts regardless of the
statistics choice, per the shell spec (first-party endpoint).

### D5: Newsletter double opt-in, minimal

`newsletter_subscribers` (email unique, status pending | confirmed |
unsubscribed, single-use token). Subscribe creates a pending row and sends
a confirmation email through the notification service. Duplicate subscribe
returns neutral success. Confirm and unsubscribe work by token. The
version-notification signup on `/lepingud/dokumendid` rides the same list.

### D6: Static navigation, CMS-driven dropdown content

The menu builder is post-prototype [L]. The header structure is static
code; the KKK dropdown reads the 7 categories from `faq-categories`, and
footer org data reads Settings. Estonian copy comes verbatim from the page
specs.

### D7: ISR tiers

Content pages set `revalidate = 3600`. Statistics use 86400 with
hide-on-failure. The ticker renders server-side once and refreshes
client-side every 60 seconds. Metadata and JSON-LD builders live in
`_lib/seo.ts` and `_lib/jsonld.ts`; canonical URLs use the marketing host
through `_lib/base-url.ts`.

### D8: Global error pages take the marketing face

`app/not-found.tsx` is new (photo, H1, CMS article search, home CTA,
`error_404` event). `app/error.tsx` gets the neutral message plus contact
data. The default host is the public face, so the global pages follow its
brand; the portal keeps its own inline error states.

## Risks / Trade-offs

- `host-areas.ts` + `middleware.ts` touch every request. The new branches
  (rewrite, cross-host redirects, 301) get unit coverage in
  `middleware.test.ts` before any page lands.
- `/lepingud` exists in two route groups (portal signing, marketing
  documents). Build-time route conflicts fail loudly, and task 1.1 tests
  both host resolutions.
- Three new tables are additive with no backfills; existing flows cannot
  regress.
- The homepage composes many data sources. Each block degrades
  independently (hide-on-failure statistics, empty ticker, hidden empty
  article block), so one failing source cannot blank the page.
