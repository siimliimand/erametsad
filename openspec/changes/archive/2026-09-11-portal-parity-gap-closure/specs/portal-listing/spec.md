## MODIFIED Requirements

### Requirement: Type tabs with counters and summary sentence

The listing at `/` SHALL present six tabs — Kõik objektid, Raieõigused,
Metskinnistud, Põllumaad, Paketid, Kiiroksjonid — as pill buttons with
count badges, a URL-persisted active tab, and a generated Estonian
summary sentence from active statistics (with volume for forest, without
for other types). The page SHALL render the demo mist page-head band
with the per-tab H1 and the summary sentence. The Kõik objekti tab
SHALL be backed by an explicit all-types definition (not an empty
object-type list), SHALL sum counters and statistics across all object
types, SHALL use the heading "Aktiivsed oksjonid", and SHALL be the
default tab when no or an unknown `tab` param is present. The Põllumaad
tab SHALL map to the `pollumaa` object type and SHALL list pollumaa
auctions; when the active set holds none, it SHALL render the demo
empty state with the count 0.

#### Scenario: Forest tab summary

- **WHEN** the raieoigused tab renders with 18 active auctions
- **THEN** the summary reads the forest pattern with count, area ha,
  volume m³, and euro value

#### Scenario: Tab change updates URL

- **WHEN** the user opens the Metskinnistud tab
- **THEN** the URL carries `tab=metskinnistud` and is shareable

#### Scenario: Kõik counts sum all types

- **WHEN** the active set holds 18 raieoigus, 15 kinnistu, 2 pollumaa,
  2 pakett, and 7 kiir auctions
- **THEN** the Kõik objektid tab shows 44 and its summary aggregates all
  five buckets

#### Scenario: Default tab

- **WHEN** the user opens `/` without a tab param
- **THEN** the Kõik objektid tab is active with the heading
  "Aktiivsed oksjonid"

#### Scenario: Põllumaad tab lists pollumaa auctions

- **WHEN** the active set holds 2 pollumaa auctions and the user opens
  `/?tab=polumaad`
- **THEN** the tab query returns those 2 auctions instead of the empty
  state

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
100, and the Raietähtaeg (aasta) select. The Raietähtaeg select SHALL
apply server-side against the auction cut-deadline year and SHALL offer
"Kõik" plus the years present in the active set (falling back to the
current year plus two when no stored years exist). The Raieliigid chips
SHALL match stored logging codes case-insensitively against the
canonical codes VR, HR, SR, LR, RD. The panel SHALL NOT contain a
volume (m³) range. All filter state SHALL serialize to the query string,
apply server-side with a 300ms debounce, and "Tühjenda" SHALL reset all.
The panel SHALL NOT contain the sort control; sorting lives in the
results bar.

#### Scenario: Filter state survives reload

- **WHEN** the user applies county and price filters and reloads the page
- **THEN** the filters re-apply from the URL and the results match

#### Scenario: Raietähtaeg filters server-side

- **WHEN** the user selects Raietähtaeg 2027 and auctions exist whose
  cut-deadline year is 2027
- **THEN** only those auctions render and the URL carries
  `cutDeadlineYear=2027`

#### Scenario: Raietähtaeg options come from stored years

- **WHEN** the active set holds auctions with cut-deadline years 2026
  and 2028 only
- **THEN** the select offers Kõik, 2026, and 2028

#### Scenario: Logging chips match canonical codes

- **WHEN** the user picks the LR chip and an auction stores the code
  `lr` or `LR`
- **THEN** that auction appears in the results

#### Scenario: Vald waits for the county

- **WHEN** no county is selected
- **THEN** the Vald select is disabled with the hint "Vali kõigepealt
  maakond."

#### Scenario: Species chips use demo codes

- **WHEN** the Puuliigid chip group renders
- **THEN** the chips read MA Mänd, KU Kuusk, KS Kask, HB Haab, LM
  Lehis, SA Saar and map to the data-layer species values
