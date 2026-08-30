# portal-listing Specification

## Purpose
TBD - created by archiving change phase-3-auction-portal. Update Purpose after archive.
## Requirements
### Requirement: Type tabs with counters and summary sentence
The listing at `/` SHALL present the five type tabs (raieoigused,
metskinnistud, polumaad, paketid, kiiroksjonid) with active counters, a
URL-persisted active tab, and a generated Estonian summary sentence from
active statistics (with volume for forest, without for other types).

#### Scenario: Forest tab summary
- **WHEN** the raieoigused tab renders with 18 active auctions
- **THEN** the summary reads the forest pattern with count, area ha,
  volume m³, and euro value

#### Scenario: Tab change updates URL
- **WHEN** the user opens the Metskinnistud tab
- **THEN** the URL becomes `/metskinnistud` and is shareable

### Requirement: Filter panel with URL state
The FilterPanel SHALL serialize all filter state to the query string:
county→parish cascade, species multi-chip, logging type multi-chip,
area/volume range, price range, and end year on forest. Filters SHALL
apply server-side with a 300ms debounce, show an active-count badge, and
"Tühjenda" SHALL reset all.

#### Scenario: Filter state survives reload
- **WHEN** the user applies county and price filters and reloads the page
- **THEN** the filters re-apply from the URL and the results match

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
The listing SHALL toggle between Loendivaade and Kaardivaade. The map
SHALL render lot pins on MapEstonia with popups (name, area,
start/current price, cadastral or registry number, mini countdown, "Vaata"
link) and cluster at low zoom. Clicking a pin SHALL navigate to
`/oksjon/:id`.

#### Scenario: Pin popup navigation
- **WHEN** the user clicks a pin's "Vaata" action
- **THEN** the browser navigates to that lot's detail page

### Requirement: Sorting and pagination
Sorting SHALL offer start price asc/desc, end time asc/desc (end time desc
default), and final price for archive contexts. Pagination SHALL be
server-side with shareable page numbers.

#### Scenario: Default sort
- **WHEN** the listing loads without a sort param
- **THEN** lots ending soonest are listed first

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

