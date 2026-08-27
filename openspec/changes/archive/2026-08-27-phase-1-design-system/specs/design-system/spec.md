## ADDED Requirements

### Requirement: Design tokens as CSS variables
The app SHALL define all design tokens (colour palette, status colours,
spacing scale, radii, shadows, motion durations and easings) as CSS custom
properties in `packages/ui/src/styles/tokens.css`. The Tailwind config
SHALL extend its theme from these variables.

#### Scenario: Tokens resolve
- **WHEN** a component uses a Tailwind utility class that maps to a token
- **THEN** the class resolves to the correct CSS variable value

### Requirement: Self-hosted fonts
The app SHALL self-host Manrope (700, 800), Inter (400, 500, 600), and
JetBrains Mono (400, 500) with `latin-ext` subset for Estonian diacritics.
Font CSS variables SHALL be set on the root layout.

#### Scenario: Fonts load
- **WHEN** a page renders
- **THEN** the three font families load without external requests to Google
  Fonts or other CDNs

### Requirement: Accessibility base styles
The app SHALL disable all animations when `prefers-reduced-motion` is
active. The app SHALL show a visible focus ring on keyboard focus. The
app SHALL provide a skip-link that moves focus to the main content area.

#### Scenario: Reduced motion
- **WHEN** the user has `prefers-reduced-motion: reduce` set
- **THEN** no CSS animation or transition plays

#### Scenario: Focus visible
- **WHEN** the user navigates with a keyboard
- **THEN** every interactive element shows a visible focus ring

#### Scenario: Skip link
- **WHEN** the user presses Tab on page load
- **THEN** a skip-link appears that moves focus to the main content

### Requirement: Colour contrast (WCAG AA)
All foreground/background token pairs SHALL meet WCAG 2.1 AA contrast
ratio (4.5:1 for normal text, 3:1 for large text).

#### Scenario: Contrast audit passes
- **WHEN** the colour-contrast audit runs against all token pairs
- **THEN** every pair meets the minimum ratio for its text size

### Requirement: Core interactive components
The library SHALL provide `Btn`, `Card`, `StatusPill`, `Countdown`,
`Accordion`, `Tabs`, `Modal`, `Drawer`, `Toast`, `EmptyState`, `DataTable`,
`Steps`, and `ChipNav` components. Each component SHALL match the
specification in `docs/design/README.md`.

#### Scenario: Btn renders variants
- **WHEN** `Btn` renders with variant `primary`, `cta`, `outline`, or `ghost`
- **THEN** the button uses the correct colour and style for that variant

#### Scenario: Countdown phases
- **WHEN** the countdown timer is above 1 hour
- **THEN** the display is neutral. When below 1 hour, the display is amber
  with a pulse. When below 5 minutes, the display is red.

#### Scenario: DataTable sorts and paginates
- **WHEN** the user clicks a column header
- **THEN** the table sorts by that column. When the user navigates pages,
  the table loads the correct page from the server.

### Requirement: Form components
The library SHALL provide `FormInput`, `FormSelect`, `FormCheck`,
`ConsentCheck`, `LeadForm`, `FormRange`, and `FormFile` components.
Form fields SHALL show floating labels, inline errors, and hint text.

#### Scenario: ConsentCheck defaults
- **WHEN** `ConsentCheck` renders
- **THEN** the checkbox is unchecked and visible

#### Scenario: LeadForm submits
- **WHEN** the user fills in the lead form and clicks submit
- **THEN** the form sends `POST /api/leads` with the correct payload and
  shows a success toast

### Requirement: Estonian validators
`packages/types` SHALL export Zod schemas for Estonian phone numbers
(`+372…`), isikukood (11-digit checksum), registrikood (8 digits), and
cadastral numbers (`NNNNN:NNN:NNNN`).

#### Scenario: Phone validation
- **WHEN** a phone number is validated
- **THEN** numbers starting with `+372` and containing 8–12 digits pass.
  Other formats fail.

#### Scenario: Isikukood validation
- **WHEN** an isikukood is validated
- **THEN** 11-digit numbers with a correct checksum pass. Invalid checksums
  fail.

### Requirement: Content components
The library SHALL provide `LotCard`, `AuctionTicker`, `SpecialistCard`,
`ContactBand`, `Testimonial`, `ArticleCard`, `DocumentLink`, `FilterPanel`,
`MapEstonia`, sticky TOC/side-nav, and `SearchableAccordion` components.

#### Scenario: LotCard displays auction data
- **WHEN** `LotCard` renders with auction props
- **THEN** the card shows the image, name, price, county, area, countdown,
  and status pill

#### Scenario: MapEstonia loads tiles
- **WHEN** `MapEstonia` renders
- **THEN** the map loads Maa-amet WMS orthophoto tiles and shows Estonian
  county outlines

#### Scenario: FilterPanel filters
- **WHEN** the user selects a filter chip
- **THEN** the panel updates the active count badge and fires the onChange
  callback

### Requirement: Styleguide dev route
The app SHALL expose a `/styleguide` route that renders every component
in every state (empty, loading, error, default).

#### Scenario: Styleguide renders
- **WHEN** a developer navigates to `/styleguide`
- **THEN** every component is visible with all its variants and states
