# design-tokens Specification

## Purpose
TBD - created by archiving change portal-listing-redesign. Update Purpose after archive.
## Requirements
### Requirement: Shared visual tokens

The design system SHALL define its visual identity as CSS custom
properties in `packages/ui/src/styles/tokens.css`, consumed through
semantic Tailwind classes. The shared palette SHALL keep its current
values for the marketing and admin surfaces: primary `#012d1d`, primary
hover `#1b4332`, primary light `#c1ecd4`, ink `#181a2e`, muted ink
`#414844`, page background `#fbf8ff`, mist background `#f4f2ff`, border
`#c1c8c2`. The portal route group SHALL override the identity inside a
`.portal-scope` wrapper (defined in
`apps/platform/src/app/(portal)/portal.css` and applied by the portal
layout) with the demo palette: primary `#2E6B4F`, primary hover
`#25573F`, primary dark `#16382A`, primary light `#E9F0EC`, page
background `#FFFFFF`, mist background `#F1F5F2`, ink `#1B211D`, muted
ink `#6B7570`, and border `#E3E7E4`. The accent, CTA, danger, and info
colors SHALL stay shared. Radii SHALL be 8px for cards and inputs, pill
(9999px) for buttons, with hero and modal at 12px and 16px. The
container SHALL max at 1200px. Status colors SHALL keep their existing
values. Components SHALL reference only semantic tokens, never raw hex
values.

#### Scenario: Portal reads the demo palette

- **WHEN** a page inside the `(portal)` route group renders
- **THEN** `bg-primary`, `bg-bgPage`, `bg-bgMist`, `text-ink`,
  `text-inkMuted`, and `border-border` resolve to the demo values
  (#2E6B4F, #FFFFFF, #F1F5F2, #1B211D, #6B7570, #E3E7E4)

#### Scenario: Marketing and admin unchanged

- **WHEN** a marketing page or an admin page renders
- **THEN** the shared token values apply and no `.portal-scope`
  override is present in the cascade

#### Scenario: Status palette stable

- **WHEN** the portal palette override lands
- **THEN** status pills keep the active/ending-soon/critical/ended
  palette and their color-phase behavior

### Requirement: Typography

Headings SHALL use Public Sans (weights 600, 700) self-hosted through
`next/font` and exposed as `--font-heading` on the default host. Inside
`.portal-scope` the portal layout SHALL load Manrope (weights 700, 800)
through `next/font` and SHALL map it to `--font-heading`, so portal
headings, the logo wordmark, and card names render in Manrope while
marketing keeps Public Sans. Body and UI text SHALL use Inter. Prices,
countdowns, and tabular data SHALL use JetBrains Mono with tabular
number alignment. The type scale (h1 48 through label 13) SHALL stay as
defined in DESIGN.md.

#### Scenario: Fonts self-hosted

- **WHEN** the page loads
- **THEN** all font files are served from the application origin with no
  external font host in the CSP

#### Scenario: Portal headings use Manrope

- **WHEN** a portal page renders an h1 through h4 or the header wordmark
- **THEN** the computed heading font family resolves to Manrope

#### Scenario: Marketing headings unchanged

- **WHEN** a marketing page renders an h1
- **THEN** the heading font family remains Public Sans

### Requirement: Icon discipline

The icon set SHALL be Lucide React only. No second icon system
(including Material Symbols) SHALL be added. Metadata icons on cards
SHALL map to `MapPin`, `Ruler`, `Trees`, and `Package`.

#### Scenario: No new icon dependency

- **WHEN** the lot card renders its metadata grid
- **THEN** the icons come from Lucide React and no icon font is loaded

