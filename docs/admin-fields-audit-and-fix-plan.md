# Admin spec-vs-code audit and fix plan

Audit date: 2026-09-08.

Question answered: do all admin pages and content types implement every field the
documentation defines?

Sources compared:

- `docs/sites/admin-erametsad-ee.md` (14-module overview, sections 3 and 4)
- `docs/design/admin/01-dashboard.md` … `14-audit-log.md` (field-level specs)
- Code: `apps/platform/src/app/(admin)/**` and `apps/platform/src/lib/data/schema/**`

Method: module-by-module comparison of every documented field, column, filter,
and action against the code. Findings below were verified in source; line
numbers refer to the file named.

Finding categories:

- **BUG** — implemented, but wrong (breaks a documented behavior).
- **GAP** — documented field, column, filter, or collection that the code lacks.
- **DECISION** — code and spec disagree by design; one side must change. Fixing
  the document is often the right fix.
- **DEFERRED** — documented as later scope in `docs/sites/admin-erametsad-ee.md`
  §7; needs a product decision to pull forward.

---

## 1. Verdict summary

| Module | State |
|---|---|
| Shell (nav, topbar) | Close to spec. 13/13 nav items, queue dots, bell, ⌘K present. Palette covers 5 of 13 modules. |
| 1 Töölaud | All 7 KPI cards and 3 queues exist. Several values, windows, and counts differ from spec. |
| 2 Oksjonid list | Strong. Missing 2 columns, select-all, and has 4 behavior bugs. |
| 3 Oksjoni koostamine | All 7 steps and most fields exist. No rich text, no server autosave, no step-7 diff, 2 spec'd fields not persisted. |
| 4 Pakkumiste jälgimine | Strong. Missing CSV export, IP-cluster heuristic, accept confirm modal. Thresholds differ. |
| 5 Sul. avamine | Two-person ceremony, reveal, verdict all exist. Reveal table lacks identity and margin columns. Approver rule differs. |
| 6 Kasutajad | Drawer with 7 tabs works. List has no filters/columns per spec. GDPR tools are shallower than spec. |
| 7 Ettevõtted | Core approve/reject/hold flow works. Registry and applicant panels miss 6 spec'd fields. |
| 8 Lepingud | Tables, templates, placeholder catalogue work. Table misses 5 spec'd columns and all filters. |
| 9 Juhtlõimed | Kanban + table + detail work. Missing county data, CSV export, 2 exit guards, merge, soft delete. |
| 10 Päringud | Routing panel works. 2 of 6 statuses missing in schema. Partner form misses 3 fields. One dead-redirect bug. |
| 11 Sisuhaldus | 10 of 12 collections exist. Pages use a raw JSON textarea; the built block builder is orphaned. Articles miss the whole SEO panel and category. |
| 12 Statistika | A period dashboard exists. Spec's BI view (€/ha, €/m³, funnel, curator, XLSX) absent — documented deferral. |
| 13 Seaded | 6 sections exist. Teavitused and Hooldusaken absent; Lipud is a raw JSON textarea; 4 field-level mismatches. |
| 14 Auditlogi | Table, drawer, diff, hash chain exist. `reason`, `sessionId`, `ipHash`, `userAgent` columns missing; export API has no button. |

---

## 2. Phase 0 — correctness bugs (fix first, small diffs)

### F-01 BUG — Service-request actions redirect through a dead path; messages are lost

`_actions/ops.ts:41-42` points `SERVICE_REQUESTS_PATH` and `PARTNERS_PATH` to
`/admin/requests` and `/admin/requests/partners`. Those routes are bare stubs
that `redirect('/admin/inquiries')` and drop the query string. Every
`?viga=`, `?teade=`, and `?detail=` state from forward/retry/mark/partner
actions is lost: after a send or an error the operator lands on the bare list
with no message and no open detail drawer.

Fix:

1. Change both constants to `/admin/inquiries` and `/admin/inquiries/partners`.
2. Update `_actions/__tests__/` expectations that reference `/admin/requests`.
3. Consider deleting the `admin/requests/*` stubs or keeping them with query
   passthrough (`redirect(\`/admin/inquiries${url.search}\`)`).

Tests: extend `admin/__tests__/routes.test.ts` to follow one action redirect and
assert the message query survives.

### F-02 BUG — Settings saves redirect through the `/admin/content/settings` stub

`_actions/content.ts:54` sets `settingsPath = '/admin/content/settings'`, a
redirect stub to `/admin/settings`. The `?ok=` and `?viga=` queries set by
`updateSettingsAction` are dropped, so `FeeChangeBanner` (`?ok=tasud`) and the
error notice never render after a save. `_actions/settings.ts:13` already uses
the correct `/admin/settings`.

Fix: point `content.ts` `settingsPath` to `/admin/settings`; update
`settings-actions.test.ts:100`, which asserts the stub path.

### F-03 BUG — "Ekspordi valitud" exports the filter, not the selection

`admin/auctions/_components/AuctionsTable.tsx:700-705` renders the bulk
"Ekspordi valitud" link with `csvHref`, which carries the current filter only.
The export API already supports `?ids=` (`api/v1/admin/auctions/export/route.ts`).

Fix: when the selection is non-empty, build the link from selected ids
(`?ids=a,b,c`); fall back to the filter link only when nothing is selected.
Rename the filter-only link to "Ekspordi filtri järgi" so the two actions are
distinct.

Tests: AuctionsTable component test — selected rows produce an ids link.

### F-04 BUG — Lead status labels disagree with the kanban columns

`_lib/labels.tsx:111,114` uses "Ühenduses" and "Diskvalifitseeritud"; the kanban
columns and spec 09 use "Võetud ühendust" and "Mittekvalifitseeritud". Status
chips, the detail status select, and the timeline therefore contradict the
column headers.

Fix: update `leadStatusLabels` to the spec copy. Check the marketing/portal side
for shared usage before renaming.

### F-05 BUG — Per-lot alapakkumise reject skips the mandatory reason

`_actions/auctions.ts:1002-1032` (`rejectAuctionBidAction`) takes no reason,
audits `bid_rejected` without one, and the `bid.rejected` notification template
(`lib/notifications/service.ts:96-99`) omits it. Spec 04:39 requires a typed
reason that goes to the bidder. The global-queue reject path already enforces
min 5 chars.

Fix: add a reason field to the per-lot reject form, validate ≥ 5 chars, include
it in the audit entry and in the notification text ("Alapakkumine lükati
tagasi: {reason}").

### F-06 BUG — Fee bound and type do not match spec

Spec 13:31 defines the default fee as a decimal, 0–10 (%). Code
(`content.ts:1261-1264`) validates an integer 0–100. A default fee of 55 is
accepted.

Fix: validate 0–10. Keep integer storage (percent). If fractional percents are
wanted later, store basis points and keep the input decimal — do not introduce a
REAL column.

### F-07 BUG — Action registry drift for maintenance and key reveal

The writer emits `maintenance.end` (`_actions/settings.ts:96`); the registry
lists `maintenance.cancel` (`admin/audit/_components/action-registry.ts:129`).
`settings.key_reveal` (written at `settings.ts:133`) is absent from the settings
group. Both land in "Muud tegevused" in the audit filter.

Fix: add both keys to the registry with human labels, or rename the writer to
`maintenance.cancel`. Pick one name (spec 14:78 uses `maintenance.cancel`).

### F-08 GAP — Audit export API has no UI button

`api/v1/admin/audit/export/{csv,json}/route.ts` exist, but nothing in
`(admin)` links to them. Spec 14:44-45 wants a filtered-CSV export button, and
spec 14:7 restricts export to superadmin, while the route admits any
`audit:read` role.

Fix: add an "Ekspordi filtreeritud CSV" button to `admin/audit/page.tsx` that
carries the current filter query. Gate the routes to superadmin only.

### F-09 BUG — Sealed ceremony approver role is not enforced

Spec 05:48: the approver must be superadmin unless a fallback is enabled.
`signSealedApproverAction` (`_actions/auctions.ts:1645-1686`) accepts any second
staff account with `sealed:operate`. Settings already store an approver-role
select (superadmin | admin) but the ceremony ignores it.

Fix: read the configured approver role in `signSealedApproverAction` and reject
a mismatched role with a clear error.

### F-10 DECISION — Isikukood masking direction

Spec 06:33 and the sites doc show `3870516*****` (first digits visible).
`_lib/labels.tsx:187-190` shows `••••••1234` (last 4 visible). The first 7
digits of an isikukood encode the birth date; showing them is the weaker
privacy choice. Recommendation: keep the code behavior, update both docs. If
product prefers the spec, change `maskIsikukood` in one place.

---

## 3. Phase 1 — content-type field gaps (schema + forms + lists)

Each item lists: schema change → form fields → list columns → tests. Migrations
run through Drizzle Kit; all changes are additive columns.

### C-1 `articles` — missing category and the whole SEO panel

Schema `lib/data/schema/articles.ts` has no category and no SEO columns
(pages have `seoTitle`/`seoDescription`; articles do not).

Add columns:

- `category` TEXT enum `('uudised','klientide-lood')` with a CHECK constraint.
- `seoTitle` TEXT, `seoDescription` TEXT, `ogImageId` TEXT → media,
  `canonicalUrl` TEXT, `robotsIndex` INTEGER boolean default true.
- `authorSpecialistId` TEXT → specialists (keep the free-text `author` for
  legacy rows).

Form (`ArticleForm.tsx`): category select; SEO panel with title counter ≤ 60,
description counter ≤ 160, OG image picker, canonical URL, robots toggles, SERP
and Open-Graph previews; author as specialist select.

List (`articles/page.tsx`): add Kategooria and Autor columns.

Note: spec 11:36-38 also wants a rich text editor and a media picker for the
cover image — tracked in R-1 (shared rich text) and M-1 (media picker).

### C-2 `pages` — wire the existing block builder; replace the JSON textarea

`admin/content/pages/[id]/page.tsx` renders only `PageForm`, whose "Paigutus
(JSON)" is a raw textarea (`PageForm.tsx:54-60`). The complete builder exists
unused: `PageBlocksBuilder`, `BlockPreview`, `BlockSettingsDrawer`,
`VersionsDrawer` are imported by nothing, and the server action
`savePageBlocksAction` (`_actions/content.ts:652`) has no caller.

Fix: render the builder on the edit page, persist through
`savePageBlocksAction`, and mount `VersionsDrawer` as the "Ajavedu" tab. Keep
the JSON textarea behind a "Kuva JSON" disclosure as an escape hatch. Add the
spec'd publish buttons (Salvesta mustand / Eelvaade / Avalda) — the scheduled
publish and version snapshot logic already exist.

Acceptance: an editor can reorder blocks, edit per-block settings in the
drawer, preview desktop/mobile, and restore a version without touching JSON.

### C-3 `faq_categories` / `faq_items` — active flag, short answer, order

- `faq-categories.ts` has no `active` column. Add
  `active` INTEGER boolean default true + form toggle + list column.
- `faq-items.ts` has no `active` and no `shortAnswer`. Add both. Form: split
  answer into "Lühitekst" + "Loe edasi…" expander per spec 11:39. Ordering is a
  number input; spec wants drag — the pages builder already has drag utilities
  to reuse (nice-to-have).

### C-4 `testimonials` — publish state

Schema has only `featured`. Add `status` TEXT enum `contentStatuses` default
'draft' (same pattern as pages), a publish toggle in `TestimonialForm`, and an
Olek list column. Optional: `rating` INTEGER (spec marks it optional).

### C-5 `redirects` — hit counter, validation, bulk import, delete reason

`saveRedirectAction` (`_actions/content.ts:1046-1070`) checks only non-empty
from/to and a valid type. `redirects.ts` has no hit counter.

Add:

- `hits` INTEGER default 0, incremented by the redirect handler; "Tabamusi"
  list column.
- Validation: `from` must start with `/`, must not equal `to`, must not chain
  into itself (walk up to depth 5).
- Typed reason on delete (`deleteRedirectAction:1072-1085` has none) + audit.
- CSV bulk import into `admin/content/import-export` (today it covers articles
  and pages JSON only).

### C-6 `media` — alt-text gate and focal point

`admin/media/page.tsx:55-59`: alt is optional at upload; `[id]/page.tsx` edits
alt without a gate. Spec 11:40 and the sites doc make alt text a hard publish
gate, and the auction wizard already enforces alt for lot images.

Fix: require alt for image mime types at upload and edit. Extend `media.ts`
with `focalX`/`focalY` INTEGER (0–100) and a focal picker on the detail page —
the lot editor's focal implementation (`MediaStep.tsx`) can be extracted and
shared. Nice-to-have: replace-file action, usages list, credits, multi-upload.

### C-7 `settings` — missing sections and fields

Current sections: Platvorm, Oksjonite reeglid, Teenustasud, Teenuse päringud
(placeholder), Integratsioonid, Rollid ja õigused. Gaps by section:

- Üldandmed: add `orgVatCode` (KMKR), support e-mail, support phone — spec 13:30
  marks the support fields required. Add alias-domain field with DNS check
  button (needs a probe endpoint; can ship the field first).
- Teenustasud: add kiiroksjoni tasu erisus %, minimaalne tasu €, and the live
  sample calculation (final price → fee + VAT → total) as a read-only computed
  block under the two inputs.
- Oksjonireeglid: add the global autobidder on/off toggle and min auction
  duration hours (default 1).
- Lipud: replace the raw JSON textarea (`SettingsForm.tsx:121-132`) with named
  toggles for `sealed_bids`, `sms_notifications`, `map_view`, `quick_auction`
  (+ `saved_search_digests`, `statistics_public`, `partner_portal`), each with
  a description. Keep the reason-required save.
- Teavitused: entirely absent, and no template storage exists (only the
  notifications log in `notifications.ts`). Add a `notification_templates`
  table (event, channel, subject, body, version, active, updatedBy) with list,
  editor (subject/body, variable inserter, placeholders from
  `placeholder-catalogue.ts` patterns), test send, version history + restore,
  and the SMS character/segment counter.
- Hooldusaken: `MaintenanceMode.tsx` is a single on/off switch. Add a
  `maintenance_windows` table (startsAt, endsAt, scope, createdBy, note), an
  aknad table UI, and the conflict checker from spec 13:69 that blocks saving a
  window in which an auction ends (query `auctions` by `endsAt` inside the
  window; list conflicts; allow force-confirm with a typed reason).
- Access: `permissions.ts` gives admin the same allow-list as superadmin,
  including `settings:write`. Spec 13:7 wants admin read-only (except
  notification templates). DECISION required — see D-6.

### C-8 `service_requests` — missing statuses and closing actions

`service-requests.ts:9` defines only `['new','routed']`. Spec 10:37/79 defines
uus / saadetud / vastatud / teostatud / aegunud / suletud.

Fix: extend the enum with `teostatud` and `suletud` (CHECK constraint update +
migration). Add `markRequestDoneAction` and `closeRequestAction` in
`_actions/ops.ts` with the row actions "Märgi teostatuks" and "Sulge" in
`admin/inquiries/page.tsx`. `vastatud` stays UI-derived from audit entries;
`aegunud` is a DECISION — code uses a 7-day partner-response window
(`inquiries/_components/routing.ts:134`), spec says 14-day request expiry with
client notification. Recommend: keep both, explicitly named ("vastamise tähtaeg
7 pd" vs "aegub 14 pd").

### C-9 `leads` — county field

Leads have no county, so the spec'd Maakond filter (09:16, 09:41), table column,
and kanban chip are impossible. Add `countyId` TEXT → counties, derived from the
first cadastre when available or set manually in the manual-create form and the
detail page. Then add the filter control (the page already accepts
`?spetsialist=` but renders no UI for it) and the two missing table columns
(ID, Maakond).

### C-10 `audit_entries` — reason, session, ip, user agent

`audit-entries.ts` stores actor, action, entity, before/after, and the hash
chain. Spec 14:43-44, 99 requires `reason`, `sessionId`, `ipHash` (salted), and
user-agent family; the sites doc adds millisecond timestamps.

Fix:

1. Add columns `reason` TEXT, `sessionId` TEXT, `ipHash` TEXT, `userAgent`
   TEXT. Additive migration only — do not touch `prevHash`/`hash`.
2. CAUTION: `repositories/audit-chain.ts` serializes the entry canonically for
   hashing. Extend the canonical serialization so new fields are covered, and
   keep verification of legacy rows (null new fields) working. Add a chain test
   that mixes pre-migration and post-migration rows.
3. Extend the audit writer signature with optional reason/session/ip/UA; thread
   them from the settings, users, and ceremony actions that already hold a
   reason.
4. UI: add the Põhjus column (truncated) to `admin/audit/page.tsx`, render
   reason + session + IP hash in `AuditDrawer.tsx`, switch `formatDateTime`
   (`_lib/labels.tsx:192-198`) to a ms-precision Europe/Tallinn formatter for
   this table, add the "Säilitamine: 7 aastat" retention notice, and add
   per-action Estonian labels to the registry (today the tooltip shows only the
   group label, `page.tsx:399`).

### C-11 `auctions` — expose area/volume and persist the 2 missing step-3 fields

- `areaHa` and `volumeM3` live only inside the `deadlines` JSON
  (`auction-schema.ts:293-298`), so the spec'd list columns (02:52) cannot
  render. Promote to real columns (`areaHa` INTEGER ha×100? — decide precision;
  `volumeM3` INTEGER) with a backfill migration from the JSON, then add the
  "ha / m³" column and "Uuendatud" (`updatedAt`) column to
  `admin/auctions/page.tsx`.
- Kooskõlastused (müüja/ostja/kooskõlastatud) and Väljaveoteed (03:52) exist
  nowhere — not in wizard state, payload, schema, or DB. Add them to the
  `deadlines` JSON (no migration needed) plus `StepLandForest` selects, or as
  columns if queried later. JSON is enough for now.
- Also add the publish gates from spec 03:97,101: specialist must be set, and
  `startsAt ≥ now + 10 min` on publish (`auction-schema.ts`
  `collectPublishGateFailures`).

---

## 4. Phase 2 — page-level gaps (grouped, spec-referenced)

### 4.1 Töölaud (01)

- Calendar-day window in Europe/Tallinn for "Lõpevad täna" (code: rolling 24 h,
  `workspace.ts:29`) + amber KPI when count > 0 (code: 5-min lookahead,
  `page.tsx:25`).
- 7-day sparkline for "Pakkumisi täna" (code: 2 points).
- "Ootel kinnitamisel" red only when > 0 (code: always `danger`).
- "Uued juhtlõimed" = today AND (unassigned OR status=uus); code filters
  status=uus only (`workspace.ts:605-608`).
- Recent leads: 8 rows (code: 3), county + specialist chip, row links.
- Fee KPI: signed × fee% without VAT (code multiplies 1.22).
- Süsteemi tervis: admin-only visibility; real queue/integration data.
- Nice-to-have: SSE resync, g+d/o/p/u/a shortcuts, KPI deep links with filters.

### 4.2 Oksjonid list (02)

- Kiiroksjonid tab must filter `isQuickAuction = true` cross-type (code filters
  `objectType = 'kiire'`).
- Default sort: active → `endsAt` asc, else id desc (`list-view.ts:46`).
- Arhiivi allowed from ended/unsold/completed (`page.tsx:377` allows two).
- Select-all-filtered checkbox, selection persisting across pages, badge with
  counts (02:63, 92).
- Ajasta avaldamine modal with per-row end-time preview and "nihuta kõiki
  lõppe ×h"; current bulk bar overwrites individual end times (02:90).
- Manual-end modal: show the leading bid (02:60) and the final-minute anti-snipe
  re-check (02:74).
- Server-side pagination (code slices one 5000-row fetch).
- Nice-to-have: hover tooltips, ⏱ anti-snipe marker, row keyboard nav, SSE
  refresh.

### 4.3 Oksjoni koostamine (03)

- R-1 rich text (below) for the two copy blocks and paketti kirjeldus.
- Server autosave (10 s idle / step change) + conflict banner with lock; today
  autosave is localStorage-only (`wizard-model.ts` comment at 424).
- Step 7: read-only field summary + two-column diff against the published
  version (03:69-70, 82).
- Piirhind field only for sealed + kiiroksjon lots (03:56); code shows it
  always.
- Pindala (ha): spec gate `area > 0`; code is a warning only
  (`auction-schema.ts:452-455`). Make it a gate.
- Mechanics lock: allow admin+ to edit end time with logging (03:41); code locks
  everyone (`auction-form.tsx:236`).
- Publish actions split: Salvesta mustandina / Ajasta / Avalda kohe (03:72).
- Rendi-/kasutusleping checkbox gating the lease deadline (03:52).
- Metsaregister link built from the first registry number (03:46); code links
  the homepage.
- Image/PDF upload service + renditions (03:82, 115) — today the UI asks for a
  URL paste; the rendition pipeline for lots already exists
  (`admin/media/_lib/media-upload.ts`).
- Map click-to-pin/drag (03:45); nice-to-have: ⌘S/⌘⏎, species Estonian names,
  name auto-suggest, gallery drag.

### 4.4 Pakkumiste jälgimine (04)

- Bids CSV export (04:18, 58) — no export route exists.
- Alapakkumised block on the monitor itself (04:26); today only on the auction
  detail page.
- Accept confirm modal with the resulting leading amount (04:38).
- "IP klaster" heuristic (04:42) — add to `monitor/_lib/anomalies.ts`.
- Expandable anomaly evidence (labels, counts, ip prefixes, timeline) (04:41-45).
- Threshold alignment: burst = age < 7 d AND ≥ 3 bids (code: 4 in 30 min);
  overtake = alternating < 10 s ×5 (code: 3 flips / 5 min)
  (`anomalies.ts:13-19`). Align code to spec or update the spec.
- Hide anomalies from sellers (04:67); link revealed identity to 06; green
  zero-state; link from sealed count to the ceremony.

### 4.5 Sul. avamine (05)

- Reveal table columns: Pakkuja (identity, masked code, company chip, link 06)
  and Marginaal (05:82, 85). Requires the reveal action to include identity in
  `RevealedBidView` (post-reveal, so it is ceremony-scoped and audited).
- Winner confirm modal: winner, price, fee estimate (05:66).
- Winner + seller notifications on confirm (05:88, 90); losers keep neutral
  copy — verify the payload discloses only the public final price, never other
  bids.
- "Ettevõtte profiil ootel" forced-choice flow for company bids (05:104).
- Empty-lot shortcut ("Märgi müümata" from the checklist, single admin) (05:61).
- "Avamine on pooleli" read-only state for other admins (05:59).
- Void outcome: spec says the lot returns to draft; the immutable status machine
  branches ended → unsold. DECISION D-4 (docs change recommended).

### 4.6 Kasutajad (06)

- List: filters (profile, status, rights, county), spec columns (profiilid,
  õigused ✓/—, pakkumiste arv, viimane sisselogimine), default sort last login
  (06:17-22, 33).
- GDPR (06:42, 84-86): async export job with a 48 h link; typed reason +
  double confirm on both actions; delete pre-check report; 14-day cooling-off;
  pseudonymise bids/contracts rows and delete unopened sealed bids (code only
  touches the user row, `anonymizeUserAction:906-935`); ZIP gains consents +
  signed contract PDFs (`exportUserGdprAction:799-807`).
- Rights: per-profile matrix rows (06:94); leading-bid warning on revoke with
  void-by-superadmin choice (06:54).
- Impersonation: 30-min TTL + banner countdown (06:77, 81).
- Shill flag action + filter (06:49) — shared with 4.4.
- Sessions detail: device, IP hash, last active (06:36).
- Nice-to-have: 7th tab on the detail page (Teavitused exists in the drawer).

### 4.7 Ettevõtted (07)

- Registry panel: add asukoht and KMKR nr; "Kontrolli uuesti" re-fetch button
  with logged view (07:39, 76).
- Applicant panel: existing profiles, bidding history, framework contract
  status (07:40).
- Volikiri enforcement: when the board check fails, require either reject or an
  approve-with-justification + power-of-attorney upload (07:80). Today approve
  stays enabled.
- Name-discrepancy amber block with side-by-side comparison (07:76).
- Ajalugu: filters (decision, date, freetext), pagination instead of
  `limit: 100`, CSV export (07:47, 83).
- SLA chip: amber > 2 days, red > 5 days, copy "oodatud {n} p"
  (`RequestCard.tsx:79-81` is a static chip).
- Approve rights defaults read from settings 13 (code hardcodes
  `['raieoigus','kinnistu']`, `RequestCard.tsx:69-70`) — depends on C-7.

### 4.8 Lepingud (08)

- Table columns: Nr, Tüüp (raam/oksjon), Mall + version, Allkirjastatud,
  Pakkuja transaction ref (08:39); framework contracts must appear in the list.
- Filters: type, status, date range, freetext over user/lot/nr; search by
  signing transaction id (08:40, 62); pagination (today `limit: 50`).
- Tühista: double confirm dialog listing consequences (08:45).
- `contract:sent` chip blue (StatusChip.tsx:55 maps it to amber).
- Template version history: uploader, note, active period, generated-contracts
  count (08:50, 93); in-use warning when editing an active template (08:59).
- Placeholder catalogue search filter (08:83).
- DECISION: PDF-first rendering (08:42, 49) vs the current HTML model — see D-7.

### 4.9 Juhtlõimed (09)

- CSV export (admin, consent-blanked) — none exists (09:60).
- Exit guards: "Võetud ühendust" requires a first note; "Leping" requires an
  auction/contract ref or note (09:79, 81) — extend
  `lead-flow.ts` `evaluateLeadExitGuard`, which only enforces the specialist
  rule from `Uus` today; spec requires the specialist rule on any move out of
  Uus and for drops to Kvalifitseeritud/Leping.
- Auto-assignment on creation from settings with county round-robin (09:53,
  90); today only a passive suggestion chip (`lead-flow.ts:86-94`).
- Duplicate merge action (09:100); soft delete for superadmin with typed reason
  (09:61, 73).
- Detail: original Sõnum + attachments (09:48); specialist filter control;
  depends on C-9 for county.
- Nice-to-have: UTM capture, timeline filter chips, newsletter chip, bell
  reminder for due next-actions.

### 4.10 Päringud (10)

Beyond C-8 (statuses/actions):

- Filters: date range, county, freetext (10:38); mask the client name in the
  table (10:37).
- Sisu preview column + Manused count with a ZIP download; attachments in the
  detail are plain text today (`inquiries/page.tsx:479-489`).
- Routing confirm modal listing recipients (10:44) + capacity soft-warning
  confirm (10:56).
- Forwarding log: real "Vastanud" column (hardcoded "—" at `page.tsx:627`),
  Märkus column, `järjekorras` state.
- Partner form: registrikood (with Äriregister prefill), kontaktisik, märkus
  (10:96); deactivate reason input (the action already reads it, the form never
  sends one).
- Manual e-mail copy fallback (10:64); "S" shortcut (10:58);
  preselect-count from settings (hardcoded 3, `page.tsx:269`).

### 4.11 Statistika (12) — DEFERRED scope, two quick wins

Site doc §7.1 defers the full statistics screen. Recommended now:

- Fix the monthly chart to stacked outcome bars (müüdud/müümata/tühistatud);
  today it plots Alghind vs Lõpphind € series (`statistics.ts:339-371`) —
  different than spec 12:65.
- Add Tüüp and Maakond filters (spec 12:36) — the aggregation helpers already
  slice by type.

Pull-forward candidates (DECISION): €/ha and €/m³ KPIs, lead funnel, public
curator toggles, XLSX export, choropleth. The curator has no storage — extend
the statistics snapshots table or settings.

### 4.12 Seaded (13)

Covered by C-7. Field-level extras beyond sections: `sealedRevisionCap` default
is 3, spec 13:32 says 0 (`settings-audit.ts:29`) — align the default (config
change, audited). Integration cards need "Testi ühendust" + viimane kontroll
timestamp + rotate field (13:74), and Äriregister/SMS/map cards are missing
(`integration-keys.ts:14-32` has 3 of 6).

### 4.13 Auditlogi (14)

Covered by C-10 and F-08. Nice-to-have: unified-diff toggle, copy-JSON,
ceremony chain strip, keyboard row nav, async export job.

### 4.14 Shell

- ⌘K palette: add the 8 missing modules to `PALETTE_GROUPS`
  (`TopbarSearch.tsx:32-64`); later, entity search.
- Environment badge: add a STAGE concept; today only dev/test render a badge
  (`layout.tsx:25-29`).
- Impersonation banner lives in the portal shell, not the admin shell
  (architectural choice — admin impersonation opens the portal). Add the
  session-expiry countdown to `(portal)/_components/ImpersonationBanner.tsx`.
- Rename the nav label "Sisu" → "Sisuhaldus" (cosmetic, sites doc line 25).

### R-1 Shared rich text editor (epic, blocks 3 items)

Spec'd in 03:108-112, 11:33 (blocks), 11:36 (articles), 11:39 (FAQ). Needed by
the wizard, page blocks, article body, FAQ answers, and legal documents (all
plain textareas today). Recommend one small toolbar-limited editor component
(headings, bold, lists, links, table, image insert from media) with a paste
allowlist and `rel="noopener"` on output, stored as sanitized HTML. Do not
adopt a heavy framework without a decision.

---

## 5. Phase 3 — decisions (fix the docs or choose)

| ID | Topic | Recommendation |
|---|---|---|
| D-1 | Routes: specs use `/oksjonid`, `/ettevotted`, …; code uses `/admin/*` consistently | Update the spec route rows; keep `/admin/*` |
| D-2 | Object types: code has `raieoigus/kinnistu/kiire/pakett`; spec has forest/property/field/package. Põllumaa does not exist | Confirm the 4-type model; update specs 02/03; drop the empty Põllumaad tab or add the type |
| D-3 | `appraised` ("Hinnatud") status exists in code, absent in specs | Add to spec status lists (02:37, sites doc) |
| D-4 | Sealed void outcome: spec 05:56 "returns to draft" vs immutable status machine `ended → unsold` | Keep `unsold` + the existing "Avalda uuesti" re-list clone; fix spec 05 |
| D-5 | Spec 05:66 defines REST ceremony endpoints; code uses server actions | Document the server-action contract in spec 05 |
| D-6 | Admin == superadmin permission tier (`permissions.ts` ADMIN_ALLOWED) vs spec 13:7 admin read-only settings | Choose: split admin from superadmin in `permissions.ts`, or amend spec 13. Blocks C-7 access gating |
| D-7 | Contracts: spec is PDF-centric (Vaata PDF, ASiC-E, PDF fallback); code renders server HTML | Decide the rendering stack before building 08 columns |
| D-8 | E-mail provider: spec says Mailgun; code uses Cloudflare Email + SMTP fallback | Update spec 13:34 |
| D-9 | Integration keys: spec wants DB-encrypted write-only; code is env-var-only with audited reveal | Keep env-var model, rewrite spec 13:73-74; remove the raw "Näita" reveal if product wants strict write-only |
| D-10 | Role matrix: spec 13:94-98 editable matrix + presets; code is read-only, code-defined | Keep read-only for now per sites doc §7.2; mark the editable matrix later scope |
| D-11 | Anomaly thresholds (04:43-44 vs `anomalies.ts:13-19`) | Align code to spec (3 bids/7 d; <10 s ×5) or write the deviation into spec 04 |
| D-12 | `aegunud`: 14-day request expiry (spec 10) vs 7-day partner-response window (code) | Keep both concepts, name them distinctly in spec 10 |
| D-13 | Species list: spec 03:51 says "24 codes" but lists 26; code implements 26 | Fix the spec wording |
| D-14 | Anti-snipe default: sites doc §7.5 open question (5 vs 13) | Code uses 5 (matches design 13:61); close the open item |
| D-15 | Collections Menüüd and Toetused (spec 11:42-43) absent | Both marked post-prototype/Phase 5. Decide: basic CRUD now or keep deferred; update the CMS collection menu doc either way |
| D-16 | Isikukood masking direction | See F-10 |
| D-17 | `maintenance.cancel` vs `maintenance.end` naming | See F-07 |

---

## 6. Suggested sequencing

1. **Week 1 — Phase 0** (F-01 … F-10). Small diffs, immediate correctness.
   Each carries a test.
2. **Weeks 2-3 — content types**: C-3, C-4, C-5, C-6 (small schema + form
   work), then C-1 (articles/SEO), C-2 (wire the builder), C-9, C-8.
3. **Weeks 3-4 — heavy schema work**: C-10 (audit columns + chain test),
   C-11 (auction columns + backfill), C-7 (settings sections; Teavitused
   storage is the largest single item).
4. **Ongoing — Phase 2** page gaps, grouped per module, D-decisions resolved
   first where a phase-2 item depends on them (D-6 before settings access,
   D-7 before contract columns).
5. **R-1 rich text** scheduled before the wizard copy-blocks and article editor
   work that needs it.

## 7. Verification

- `pnpm lint`, `pnpm typecheck`, `pnpm build` must pass per guardrails.
- Schema changes: Drizzle Kit migration + `schema` unit tests; schema lint bans
  REAL money columns and enum-like TEXT without CHECK.
- Audit chain: add a mixed-era chain verification test before shipping C-10.
- Every action-path fix (F-01, F-02, F-03, F-05) gets a route/action test that
  asserts the redirect target and message.
- Label changes (F-04) need a grep across marketing/portal for shared usage.
