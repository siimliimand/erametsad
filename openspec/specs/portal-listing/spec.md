# portal-listing Specification

## Purpose
TBD - created by archiving change phase-3-auction-portal. Update Purpose after archive.
## Requirements
### Requirement: Type tabs with counters and summary sentence

The listing at `/` SHALL present six tabs — Kõik objektid, Raieõigused,
Metskinnistud, Põllumaad, Paketid, Kiiroksjonid — with active counters, a
URL-persisted active tab, and a generated Estonian summary sentence from
active statistics (with volume for forest, without for other types). The
Kõik objektid tab SHALL be backed by an explicit all-types definition
(not an empty object-type list), SHALL sum counters and statistics across
all object types, SHALL use the heading "Aktiivsed oksjonid", and SHALL
be the default tab when no or an unknown `tab` param is present. The
Põllumaad tab keeps its empty-state behavior until the schema gains a
matching object type.

#### Scenario: Forest tab summary

- **WHEN** the raieoigused tab renders with 18 active auctions
- **THEN** the summary reads the forest pattern with count, area ha,
  volume m³, and euro value

#### Scenario: Tab change updates URL

- **WHEN** the user opens the Metskinnistud tab
- **THEN** the URL carries `tab=metskinnistud` and is shareable

#### Scenario: Kõik counts sum all types

- **WHEN** the active set holds 18 raieoigus, 15 kinnistu, 2 pakett, and
  7 kiir auctions
- **THEN** the Kõik objektid tab shows 42 and its summary aggregates all
  four buckets

#### Scenario: Default tab

- **WHEN** the listing loads without a `tab` param
- **THEN** the Kõik objektid tab is active with the heading "Aktiivsed
  oksjonid"

### Requirement: Filter panel with URL state

The FilterPanel SHALL serialize all filter state to the query string:
county→parish cascade, species multi-chip, logging type multi-chip,
area/volume range, price range, and end year on forest. Filters SHALL
apply server-side with a 300ms debounce, show an active-count badge, and
"Tühjenda" SHALL reset all. The panel SHALL render as a left sidebar
aside at `lg` and above (3 of 12 columns) and SHALL collapse into a
disclosure above the map on smaller viewports. The panel SHALL NOT
contain the sort control; sorting lives in the results bar.

#### Scenario: Filter state survives reload

- **WHEN** the user applies county and price filters and reloads the page
- **THEN** the filters re-apply from the URL and the results match

#### Scenario: Sidebar at desktop

- **WHEN** the listing renders at `lg` or wider
- **THEN** the filter panel occupies the left aside and the results the
  main column

#### Scenario: Collapsed on mobile

- **WHEN** the listing renders below `lg`
- **THEN** the filters are collapsed until the user opens the disclosure

### Requirement: Saved-search subscription entry
The listing filter panel SHALL offer a "Telli teavitus" action for the
current filter state. For authed users it SHALL open the subscription
modal prefilled with the active filters (channel and frequency
selectable) and save through `POST /api/v1/auction-subscriptions`. For
guests it SHALL ask for email with a required visible consent checkbox
and save the subscription against that email. Success SHALL confirm with
a toast; errors SHALL show inline.

#### Scenario: Authed subscription from filters
- **WHEN** an authed user applies a Lääne-Viru county filter and clicks
  "Telli teavitus"
- **THEN** the modal opens prefilled with that filter and saving creates
  the subscription

#### Scenario: Guest subscription requires consent
- **WHEN** a guest submits the subscription form with an empty consent
  checkbox
- **THEN** submit is blocked with an inline error on the checkbox

### Requirement: Map view

The listing SHALL render the map always visible above the results bar on
all viewports; the Loendivaade/Kaardivaade toggle SHALL NOT exist and a
legacy `view=kart` param SHALL be accepted and ignored. The map SHALL
render lot pins on MapEstonia with popups (name, area, start/current
price, cadastral or registry number, mini countdown, "Vaata" link) and
cluster at low zoom. Clicking a pin SHALL navigate to `/oksjon/:id`. The
map SHALL be about 400px tall at desktop and proportionally shorter on
mobile.

#### Scenario: Pin popup navigation

- **WHEN** the user clicks a pin's "Vaata" action
- **THEN** the browser navigates to that lot's detail page

#### Scenario: Map and list together

- **WHEN** the listing renders in its default state
- **THEN** the map and the card grid are both visible without a view
  toggle

#### Scenario: Legacy view param

- **WHEN** a shared URL contains `view=kart`
- **THEN** the page renders the standard layout without error

### Requirement: Sorting and pagination

A results bar above the card grid SHALL show the found count in Estonian
("Leitud N oksjonit") and the sort select. Sorting SHALL offer start
price asc/desc and end time asc/desc (end time asc default), and final
price for archive contexts. Pagination SHALL be server-side with
shareable page numbers.

#### Scenario: Default sort

- **WHEN** the listing loads without a sort param
- **THEN** lots ending soonest are listed first

#### Scenario: Result count

- **WHEN** a tab and filters match 12 auctions
- **THEN** the results bar reads "Leitud 12 oksjonit"

### Requirement: Live listing updates
The listing SHALL subscribe to the auction SSE stream: newly published
lots prepend with a highlight, anti-snipe extensions update countdowns
in place, and ended lots flip to their ended presentation.

#### Scenario: Extension updates countdown
- **WHEN** an `auction:extended` event arrives for a visible lot
- **THEN** that card's countdown resets to the new end time without a
  reload

### Requirement: Empty and error states
An empty tab SHALL show the Estonian empty state with subscription
guidance; zero filter results SHALL offer "Tühjenda filtrid"; load
failures SHALL show a retry button. Kiiroksjonid with zero SHALL link to
the marketing explainer.

#### Scenario: Empty filter result
- **WHEN** filters match no auctions
- **THEN** the empty result message with "Tühjenda filtrid" renders

### Requirement: Lot card presentation

The active listing card SHALL present: the object image with a type-badge
overlay (object type in Estonian) and the live countdown; a 2×2 metadata
grid with location (parish, county), area in ha, species names, and
volume in m³ (cells without data collapse); an Alghind price block; and
a "Vaata lähemalt" call to action. All presentation-only props SHALL be
optional so existing consumers (`AuctionTicker`, `ArchiveCard`) render
their current minimal presentation unchanged. The whole card SHALL
remain a single link to the lot page.

#### Scenario: Full card on the listing

- **WHEN** a lot with parish, species, and volume renders on the listing
- **THEN** the card shows the type badge, countdown overlay, four
  metadata cells, price block, and call to action

#### Scenario: Legacy consumers unchanged

- **WHEN** `AuctionTicker` renders the card without the new props
- **THEN** the card renders its previous minimal presentation without
  errors or empty cells

