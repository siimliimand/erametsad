# portal-archive Specification

## Purpose
TBD - created by archiving change phase-3-auction-portal. Update Purpose after archive.
## Requirements
### Requirement: Archive tabs and counters
`/ajalugu` SHALL present the type tabs (Kõik objektid, Raieõigused,
Metskinnistud, Põllumaad, Paketid, Kiiroksjonid) as pill buttons with
archived counters from archived statistics, persisted in the URL,
defaulting to the first tab, styled like the listing tab bar.

#### Scenario: Tab counters reflect archive
- **WHEN** the archive loads
- **THEN** each tab label shows its archived auction count in a pill
  with the active tab highlighted

### Requirement: Archive statistics band
The archive SHALL show the demo four-card statistics band in the page
head: "Edukalt lõppenud oksjonit", "Metsa- ja põllumaad kokku (ha)",
"Raiemaht kokku (m³)", and "Kogumaksumus (€)". The figures SHALL come
from the existing statistics snapshots and render in mono. The band
SHALL hide gracefully when the aggregation returns no data.

#### Scenario: Band shows all-time totals
- **WHEN** the archive loads with statistics data
- **THEN** the four stat cards show the auction count, total hectares,
  total volume, and the euro total

#### Scenario: Empty aggregation hides the band
- **WHEN** the statistics aggregation returns no data
- **THEN** the band hides without layout errors

### Requirement: Archive filters and sorting
The archive filter sidebar SHALL render as the demo card with the
"Lõppemise aasta" select (Kõik plus years with data), the "Tüüp" chip
group (Raieõigus, Kinnistu, Põllumaa, Pakett), the "Olek" chip group
(Lõppenud, Müümata) with the hint "Müümata jäänud oksjonid on arhiivis
avalikud.", and "Tühjenda". County, parish, species, logging type,
price, and area filters SHALL NOT render in the archive sidebar. All
filter state SHALL be URL-encoded with an active-count badge. The
toolbar SHALL show the result count "N oksjonit" (role="status") and
the sort select labeled "Sorteeri" with the demo options: "Uuemad
eespool" (default), "Vanemad eespool", "Lõpphind kahanevalt", "Lõpphind
kasvavalt". Pagination SHALL be server-side at 24 per page in the demo
style.

#### Scenario: Default sort
- **WHEN** the archive loads without a sort param
- **THEN** results order newest first under the label "Uuemad eespool"

#### Scenario: Filter to a single year
- **WHEN** the user selects Lõppemise aasta 2025
- **THEN** only lots that ended in 2025 are listed and the URL carries
  the filter

#### Scenario: Status chip filters unsold
- **WHEN** the user picks the Müümata chip
- **THEN** only unsold auctions are listed and the URL carries the
  filter

### Requirement: Archive card privacy
The archive results SHALL render as the demo table (`.ar-table`
presentation, horizontally scrollable below the demo minimum width) with
the columns Objekt, Tüüp, Maakond, Pindala, Lõppkuupäev, Lõpphind,
Alghind, and Ülepakkumine. The Objekt cell SHALL show the lot name as a
link plus the mono id. The Tüüp cell SHALL show a color-coded chip per
object type. The Lõpphind SHALL render in the demo amber price style;
the Ülepakkumine cell SHALL show the uplift pill "+N%" computed from
start and final price. The table SHALL NOT show winner identity or bid
counts anywhere on the archive or the ended detail, and a privacy
footnote with an info icon SHALL state "Avalikustame ainult lõpphinda —
võitja andmeid ei avaldata."

#### Scenario: No winner leakage
- **WHEN** any user browses the archive or an ended lot's detail
- **THEN** no winner name, bidder identity, or bid count is rendered

#### Scenario: Uplift pill
- **WHEN** a row shows a final price above the start price
- **THEN** the Ülepakkumine cell shows the "+N%" pill in the demo green

#### Scenario: Table on mobile
- **WHEN** the archive renders below the table's minimum width
- **THEN** the table scrolls horizontally inside its container

### Requirement: Unsold archive entries
Unsold lots SHALL render as muted demo rows: the "Müümata" pill in the
Lõpphind column, "—" in the Ülepakkumine column, and the muted row
presentation.

#### Scenario: Unsold row
- **WHEN** an archived lot has no sale
- **THEN** its row shows the "Müümata" pill and "—" in the uplift
  column

### Requirement: Ended detail cross-link
Ended lot pages SHALL offer "Vaata sarnaseid oksjoneid" linking to the
active listing filtered by the same county and object type.

#### Scenario: Similar lots link
- **WHEN** the user clicks the similar-lots link on an ended lot
- **THEN** the listing opens filtered to that county and type

