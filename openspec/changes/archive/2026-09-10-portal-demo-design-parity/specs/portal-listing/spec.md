## MODIFIED Requirements

### Requirement: Type tabs with counters and summary sentence

The listing at `/` SHALL present six tabs — Kõik objektid, Raieõigused,
Metskinnistud, Põllumaad, Paketid, Kiiroksjonid — as pill buttons with
count badges, a URL-persisted active tab, and a generated Estonian
summary sentence from active statistics (with volume for forest, without
for other types). The page SHALL render the demo mist page-head band
with the per-tab H1 and the summary sentence. The Kõik objektid tab
SHALL be backed by an explicit all-types definition (not an empty
object-type list), SHALL sum counters and statistics across all object
types, SHALL use the heading "Aktiivsed oksjonid", and SHALL be the
default tab when no or an unknown `tab` param is present. The Põllumaad
tab keeps its empty-state behavior until the schema gains a matching
object type.

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

#### Scenario: Pill tab bar

- **WHEN** the tab bar renders
- **THEN** each tab is a pill button with its count badge and the active
  tab shows the demo active style

### Requirement: Filter panel with URL state

The filter panel SHALL render as the demo 280px sticky left sidebar card
titled "Filtrid" with the active-count badge, and SHALL collapse behind
a "Filtrid (n)" disclosure button below the desktop breakpoint. It
SHALL contain: the Maakond select (placeholder "Kõik maakonnad"), the
Vald select disabled until a county is chosen (hint "Vali kõigepealt
maakond."), the Puuliigid chip group (MA Mänd, KU Kuusk, KS Kask, HB
Haab, LM Lehis, SA Saar), the Raieliigid chip group (VR, HR
Harvendusraie, SR Sanitaarraie, LR Lageraie, RD Rekonstruktsiooniraie),
the Pindala (ha) min/max range, the Hind (€) min/max range with step
100, and the Raietähtaeg (aasta) select. The panel SHALL NOT contain a
volume (m³) range. All filter state SHALL serialize to the query string,
apply server-side with a 300ms debounce, and "Tühjenda" SHALL reset all.
The panel SHALL NOT contain the sort control; sorting lives in the
results bar.

#### Scenario: Filter state survives reload

- **WHEN** the user applies county and price filters and reloads the page
- **THEN** the filters re-apply from the URL and the results match

#### Scenario: Sidebar at desktop

- **WHEN** the listing renders at desktop width
- **THEN** the 280px sticky filter card sits left of the results column

#### Scenario: Vald waits for the county

- **WHEN** no county is selected
- **THEN** the Vald select is disabled with the hint "Vali kõigepealt
  maakond."

#### Scenario: Species chips use demo codes

- **WHEN** the Puuliigid chip group renders
- **THEN** the chips read MA Mänd, KU Kuusk, KS Kask, HB Haab, LM
  Lehis, SA Saar and map to the data-layer species values

### Requirement: Saved-search subscription entry
The listing filter panel SHALL offer a "Telli teavitus" action for the
current filter state. For guests it SHALL expand the demo inline
sub-form with the "E-post" input (placeholder "sinu@email.ee"), the
required visible consent checkbox ("Nõustun, et Erametsad töötleb mu
isikuandmeid sobivate oksjonite teavitamiseks."), and the "Telli
teavitus" submit that saves the subscription against that email. For
authed users it SHALL open the subscription modal prefilled with the
active filters (channel and frequency selectable) and save through
`POST /api/v1/auction-subscriptions`. Success SHALL confirm with a
toast; errors SHALL show inline.

#### Scenario: Guest inline subscription
- **WHEN** a guest expands the sub-form, enters an email, ticks the
  consent, and submits
- **THEN** the subscription saves against that email and a toast
  confirms

#### Scenario: Guest subscription requires consent
- **WHEN** a guest submits the subscription form with an empty consent
  checkbox
- **THEN** submit is blocked with an inline error on the checkbox

#### Scenario: Authed subscription from filters
- **WHEN** an authed user applies a Lääne-Viru county filter and clicks
  "Telli teavitus"
- **THEN** the modal opens prefilled with that filter and saving creates
  the subscription

### Requirement: Map view

The listing SHALL offer the demo view toggle with two `aria-pressed`
buttons, Kaardivaade and Loendivaade, persisted in the URL
(`view=kaart`). The default SHALL be Loendivaade. On Kaardivaade the
map SHALL replace the card grid and SHALL render lot pins on MapEstonia
with the demo popup card (Pindala, Alghind, Katastritunnus, Aega
jäänud, and a "Vaata" button). Clicking "Vaata" SHALL navigate to
`/oksjon/:id`. Escape SHALL close the open popup. A legacy `view=kart`
param SHALL select the map view.

#### Scenario: Toggle switches views

- **WHEN** the user clicks Kaardivaade
- **THEN** the map replaces the card grid and the URL carries
  `view=kaart`

#### Scenario: Pin popup navigation

- **WHEN** the user clicks a pin's "Vaata" action
- **THEN** the browser navigates to that lot's detail page

#### Scenario: Legacy view param

- **WHEN** a shared URL contains `view=kart`
- **THEN** the page renders the map view without error

### Requirement: Sorting and pagination

A results bar above the card grid SHALL show the found count in Estonian
("Leitud N oksjonit"), the mobile "Filtrid (n)" disclosure trigger below
the desktop breakpoint, and the sort select labeled "Sorteeri" with the
demo options: "Varem lõppevad eespool" (default), "Hiljem lõppevad
eespool", "Alghind kasvavalt", "Alghind kahanevalt". Pagination SHALL be
server-side with shareable page numbers rendered in the demo style:
chevron previous/next buttons and numbered page buttons with the current
page highlighted.

#### Scenario: Default sort

- **WHEN** the listing loads without a sort param
- **THEN** lots ending soonest are listed first under the label "Varem
  lõppevad eespool"

#### Scenario: Result count

- **WHEN** a tab and filters match 12 auctions
- **THEN** the results bar reads "Leitud 12 oksjonit"

#### Scenario: Pagination navigation

- **WHEN** the user clicks page 2
- **THEN** the URL carries `page=2` and the next result page renders

### Requirement: Lot card presentation

The active listing SHALL render `PortalLotCard` with the demo anatomy:
a 16/10 media area with the "Kiiroksjon" flag (bolt icon) when
applicable; the body with the object type label and the status pill side
by side, the lot name, the cadastre in mono, the meta line "<area> ha ·
<volume> m³ · <county>", the price block with the small "Alghind" label
over the price in mono with the demo amber price color, and the
countdown "Aega jäänud <d>p <HH:MM:SS>" with the demo warn (<1h) and
critical (<5min) states. The whole card SHALL remain a single link to
the lot page. Cards SHALL lay out in the demo dense grid
(auto-fill, minimum 270px columns, 24px gap). The shared `LotCard`
SHALL stay unchanged for existing consumers (`AuctionTicker`,
`ArchiveCard`).

#### Scenario: Full card on the listing

- **WHEN** a lot with county, species, and volume renders on the listing
- **THEN** the card shows the type label, status pill, name, cadastre,
  meta line, amber Alghind price, and the countdown in the demo format

#### Scenario: Countdown states

- **WHEN** a card's auction ends in under one hour
- **THEN** the countdown turns the warn color; under five minutes it
  turns the critical color

#### Scenario: Legacy consumers unchanged

- **WHEN** `AuctionTicker` renders its cards
- **THEN** the shared `LotCard` presentation is unchanged

### Requirement: Free-text search filter
The listing SHALL accept a `q` query parameter as a free-text filter
matching the auction title and cadastral numbers. The filter SHALL
combine with the existing filters, sort, and pagination, and SHALL be
clearable via "Tühjenda". The demo layout has no dedicated search input,
so no visible search box is required; deep links and saved URLs SHALL
keep working.

#### Scenario: Search param filters the listing
- **WHEN** a URL with `q=metskits` opens
- **THEN** the listing shows auctions whose title or cadastral numbers
  match the term

#### Scenario: Search combines with filters
- **WHEN** a `q` value and a county filter are both active
- **THEN** results satisfy both conditions and the active-count badge
  counts both

#### Scenario: Clearing removes the term
- **WHEN** the user activates "Tühjenda"
- **THEN** the `q` param is removed from the URL and full results return
