# marketing-shell

## ADDED Requirements

### Requirement: Marketing layout and shell mount

Every `(marketing)` page SHALL render inside the marketing layout:
MarketingHeader, page content, ContactBand, MarketingFooter, and
CookieBanner. The layout SHALL provide the marketing canonical base URL so
pages emit absolute canonical links.

#### Scenario: Shell wraps a content page

- **WHEN** a visitor opens `/kontakt`
- **THEN** the page renders between the marketing header, the contact
  band, and the footer

### Requirement: Header navigation

The header SHALL be sticky at 72px desktop and 56px mobile, and SHALL
shrink to 60px on scroll on desktop. It SHALL show dropdown menus for Metsa
müümine (5 subpages), KKK (hub plus 7 CMS categories), Päringud, and Meist,
plain links for Kiiroksjonid and Uudised, external links with an arrow
icon, the CTA "Oksjonikeskkond" pointing at the portal host, an
active-page underline, and a skip link. On viewports at most 768px the
menu SHALL collapse into a hamburger that opens a right Drawer with
accordion groups and a fixed CTA.

#### Scenario: Dropdown shows CMS FAQ categories

- **WHEN** the KKK dropdown opens
- **THEN** it lists the 7 category pages from the CMS faq-categories

#### Scenario: Mobile navigation

- **WHEN** a visitor on a small viewport opens the hamburger
- **THEN** the full menu renders in a Drawer with accordion groups, and
  the external links and CTA sit fixed at the drawer bottom

### Requirement: Footer

The footer SHALL render 5 columns: active auctions by type, auction
history by type (both deep links into the portal host), articles, useful
links, and social icons with aria labels. The bottom row SHALL show org
data from Settings with links to the privacy policy and the cookie
settings. On mobile the columns SHALL collapse into accordions. A footer
link without content SHALL not render.

#### Scenario: Missing document link

- **WHEN** a footer-linked PDF is not uploaded
- **THEN** the link is absent instead of rendering an empty anchor

### Requirement: Cookie consent

The CookieBanner SHALL be non-modal with three buttons: "Nõustun kõigiga",
"Ainult vajalikud", and "Sätete muutmine" opening a granular Modal with
necessary consent locked, statistics, and marketing. Consent SHALL be
stored in the `erametsad_consent` cookie for 12 months and POSTed to
`/api/v1/consent`. Analytics SHALL load only after statistics consent. The
decision SHALL reopen from the footer link.

#### Scenario: Necessary-only choice

- **WHEN** a visitor picks "Ainult vajalikud"
- **THEN** the banner disappears, no analytics scripts load, and the
  choice is logged server-side

### Requirement: Error pages

The 404 page SHALL show a forest photo, an H1, a CMS article search, a
home CTA, and SHALL log `error_404{path}`. The 500 page SHALL show the
neutral message "Süsteemi häire, töötame selle kallal" with phone and
email.

#### Scenario: Unknown path

- **WHEN** a visitor opens a path that matches no route on the default
  host
- **THEN** the branded 404 renders with a working article search
