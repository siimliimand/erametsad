## MODIFIED Requirements

### Requirement: Archive filters and sorting
The archive filter sidebar SHALL render as the demo card with the
"Lõppemise aasta" select (Kõik plus years with data), the "Tüüp" chip
group (Raieõigus, Kinnistu, Põllumaa, Pakett), the "Olek" chip group
(Lõppenud, Müümata) with the hint "Müümata jäänud oksjonid on arhiivis
avalik.", and "Tühjenda". The Põllumaa chip SHALL filter by the
`pollumaa` object type; a selection that matches no archived auctions
SHALL render the demo empty state instead of an error. County, parish,
species, logging type, price, and area filters SHALL NOT render in the
archive sidebar. All filter state SHALL be URL-encoded with an
active-count badge. The toolbar SHALL show the result count
"N oksjonit" (role="status") and the sort select labeled "Sorteeri"
with the demo options: "Uuemad eespool" (default), "Vanemad eespool",
"Lõpphind kahanevalt", "Lõpphind kasvavalt". Pagination SHALL be
server-side at 24 per page in the demo style.

#### Scenario: Default sort
- **WHEN** the archive loads without a sort param
- **THEN** results order newest first under the label "Uuemad eespool"

#### Scenario: Filter to a single year
- **WHEN** the user selects Lõppemise aasta 2025
- **THEN** only lots that ended in 2025 are listed and the URL carries
  the filter

#### Scenario: Põllumaa chip filters pollumaa
- **WHEN** the archive holds ended pollumaa auctions and the user picks
  the Põllumaa chip
- **THEN** only pollumaa auctions are listed and the URL carries the
  filter

#### Scenario: Põllumaa chip with no data
- **WHEN** no pollumaa auction is archived and the user picks the
  Põllumaa chip
- **THEN** the demo empty state renders with the result count 0

#### Scenario: Status chip filters unsold
- **WHEN** the user picks the Müümata chip
- **THEN** only unsold auctions are listed and the URL carries the
  filter
