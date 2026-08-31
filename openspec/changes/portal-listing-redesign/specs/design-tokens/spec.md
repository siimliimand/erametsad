## ADDED Requirements

### Requirement: Shared visual tokens

The design system SHALL define its visual identity as CSS custom
properties in `packages/ui/src/styles/tokens.css`, consumed through
semantic Tailwind classes. The palette SHALL be: primary `#012d1d`,
primary hover `#1b4332`, primary light `#c1ecd4`, ink `#181a2e`, muted
ink `#414844`, page background `#fbf8ff`, mist background `#f4f2ff`,
border `#c1c8c2`. Radii SHALL be 8px for cards and inputs, pill
(9999px) for buttons, with hero and modal at 12px and 16px. The
container SHALL max at 1200px. Status, danger, info, and CTA colors
SHALL keep their existing values. Components SHALL reference only
semantic tokens, never raw hex values.

#### Scenario: Component reads the token

- **WHEN** the primary color changes in `tokens.css`
- **THEN** every surface using `bg-primary` or `text-primary` updates
  without component edits

#### Scenario: Status palette stable

- **WHEN** the identity swap lands
- **THEN** status pills keep the active/ending-soon/critical/ended
  palette and their color-phase behavior

### Requirement: Typography

Headings SHALL use Public Sans (weights 600, 700) self-hosted through
`next/font` and exposed as `--font-heading`. Body and UI text SHALL use
Inter. Prices, countdowns, and tabular data SHALL use JetBrains Mono
with tabular number alignment. The type scale (h1 48 through label 13)
SHALL stay as defined in DESIGN.md.

#### Scenario: Fonts self-hosted

- **WHEN** the page loads
- **THEN** all font files are served from the application origin with no
  external font host in the CSP

### Requirement: Icon discipline

The icon set SHALL be Lucide React only. No second icon system
(including Material Symbols) SHALL be added. Metadata icons on cards
SHALL map to `MapPin`, `Ruler`, `Trees`, and `Package`.

#### Scenario: No new icon dependency

- **WHEN** the lot card renders its metadata grid
- **THEN** the icons come from Lucide React and no icon font is loaded
