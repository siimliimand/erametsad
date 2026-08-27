# Lepingud & mallid — Contracts & templates

> **In brief:** Manage contract templates and track signature status.
| Area | admin |
|---|---|
| **Route** | `/lepingud` (tab Lepingud), `/lepingud/mallid` (tab Mallid) |
| **Access** | admin, superadmin (template activate/deactivate + void: superadmin or delegated admin) |
| **In nav** | sidebar "Lepingud" |

## Purpose & user goals
Track every framework and auction contract through prepared → sent → signed → voided; manage DOCX templates with placeholder catalogue, versioning and test-render — new contract wording without redeploy (plan §5.8).

## Wireframe (desktop)
```
Tab Lepingud:
┌───────────────────────────────────────────────────────────────────────────┐
│ Lepingud  [Lepingud 1284] [Mallid 9]     Otsing: kasutaja/oksjon/nr      │
│ Filtrid: [Tüüp ▾ raam/oksjon][Olek ▾][Kuupäev —]                         │
├────┬────────┬──────────┬───────────────┬──────────┬─────────┬─────────────┤
│Nr  │ Tüüp   │ Kasutaja │ Oksjon        │ Mall     │ Olek    │ Allkirj.    │
│1024│oksjon  │ T. Kask  │ #4812 Ööviiuli│ MK v3.1  │ ▣ saadetud│ —          │
│1023│raam    │ A. Saar  │ —             │ RL v2.0  │ ✓ allkirj.| 27.08 14:22│
├────┴────────┴──────────┴───────────────┴──────────┴─────────┴─────────────┤
│ Row: [Vaata PDF][Laadi allkirjakonteiner ↓][Saada uuesti][Tühista ⚠]      │
└───────────────────────────────────────────────────────────────────────────┘
Tab Mallid:
┌───────────────────────────────────────────────────────────────────────────┐
│ [+ Uus mall (laadi DOCX)]                                                 │
│ ┌ Mall ────────────────────────────────────────────────────────────────┐  │
│ │ Raamleping · v2.1 · ● AKTIIVNE · v2.0 (26.01) v1.3 (14.06.2025)     │  │
│ │ [Kohatäited: {{bidder.name}} {{user.isikukood}} …] [Testrender …]   │  │
│ │ [Muuda faili] [Deaktiveeri ⚠] [Ajalugu]                             │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

## Block-by-block spec
**Tab 1 Lepingud — DataTable**
- Columns: Nr; Tüüp (raamleping / oksjonileping); Kasutaja (name + company chip, link 06); Oksjon (id+name or "—" for framework); Mall (name+version pinned at generation); Olek chip — prepared hall / saadetud sinine / allkirjastatud roheline / tühistatud punane; Allkirjastatud (signed_at); Pakkuja (eID provider ref/transaction id, tooltip); Loodud.
- Filters: type, status, date range, freetext (user, lot, contract nr). Sort default created desc.
- Row actions:
  - Vaata PDF — inline viewer (rendered document).
  - Laadi allkirjakonteiner — signed DDOC/BDOC container download (superadmin/admin).
  - Saada ucesti (resend) — for `sent`: re-triggers signing invitation (user notified, link refreshed); counter of resends shown.
  - **Tühista (void)** — typed reason mandatory; double-confirm listing consequences ("Kasutaja teavitatakse; kui leping oli oksjonileping, oksjoni tulemus jääb kehtima ja vajab uut lepingut / või tühistatakse tulemus" — outcome select: only-contract void vs void-contract-and-auction-result (latter superadmin only)); audit `contract.void`.
- Generation queue status strip: pending PDF renders count with retry control (errors from Gotenberg worker).

**Tab 2 Mallid — template manager**
- Upload: DOCX (primary; PDF fallback read-only) → parse placeholders `{{…}}` → validation: unknown placeholders listed with red marks; missing required placeholders listed.
- Template card: name, type (framework/auction + object type scope), version, active toggle, file meta, versions list (version, uploaded_at, uploader, note, active-period).
- **Placeholder catalogue** (editor sidebar, insert-on-click; full list from data model §8):
  - Pakkuja/kasutaja: `{{bidder.name}}`, `{{bidder.isikukood}}` (or `{{bidder.registrikood}}`), `{{bidder.address}}`, `{{bidder.email}}`, `{{bidder.phone}}`, `{{bidder.companyName}}`
  - Oksjon: `{{lot.id}}`, `{{lot.name}}`, `{{lot.objectType}}`, `{{lot.county}}`, `{{lot.parish}}`, `{{lot.address}}`, `{{lot.area}}`, `{{lot.volume}}`, `{{lot.cadastres}}` (list, comma-joined), `{{lot.registryNumbers}}`, `{{lot.forestNotifications}}`, `{{lot.loggingDeadline}}`, `{{lot.removalDeadline}}`, `{{lot.minBid}}`, `{{lot.finalPrice}}`, `{{lot.loggingTypes}}`, `{{lot.compartments}}`
  - Paketi: `{{lot.propertyCount}}`, `{{lot.packageDescription}}`, `{{lot.packageTable}}` (rendered as table)
  - Tehing: `{{bid.amount}}`, `{{bid.submittedAt}}`, `{{auction.endedAt}}`, `{{fee.percent}}`, `{{fee.amountVatExcl}}`, `{{fee.amountVat}}`, `{{fee.total}}`
  - Osapooled: `{{company.legalName}}`, `{{company.regCode}}`, `{{company.address}}`, `{{company.kmkr}}`, `{{signer.name}}`, `{{signer.idCode}}`, `{{date.today}}`
- Versioning: uploading same type creates new version (draft) — never overwrites; activate promotes version (only one active per type+scope); deactivation requires typed reason + blocks if contracts pending on it? (no — pinned per contract; safe).
- **Testrender**: button opens drawer with dummy data preview (fictional bidder "Test Testov 39101010000", lot fixture) → renders PDF inline; diff-check vs previous version optional.
- Warning banner on templates edited after auctions using them opened ("Kehtib 3 käimasoleval oksjonil — uus versioon rakendub ainult uutele lepingutele").

## Interactions & edge cases
- Search by signing transaction id (support use case).
- Resend throttled (max 1/hour) to prevent spam; counter shown.
- Signed contract hash shown in detail (verify integrity, matches audit log).
- Framework contract check from 06 user detail links here filtered.
- Keyboard: V view, R resend on focused row.

## Data & API
`GET /api/admin/contracts?where=`, `POST /api/admin/contracts/:id/resend`, `POST :id/void {reason, outcome}`; templates: `GET/POST /api/admin/contract-templates` (upload, new version), `POST :id/activate|deactivate {reason}`, `POST :id/test-render` (dummy data render). Generation queue from BullMQ.

## States
Empty: "Lepinguid ei leitud". Void confirm guard: reason <5 chars blocks submit. Template placeholder errors: upload rejected with row-listed unknown tokens.

## Copy (Estonian, draft)
"Lepingud" · "Mallid" · "Raamleping" · "Oksjonileping" · "Valmistatud" · "Saadetud" · "Allkirjastatud" · "Tühistatud" · "Saada uuesti" · "Tühista leping" · "Tühistamise põhjus (kohustuslik)" · "Laadi allkirjakonteiner" · "Uus mall" · "Kohatäited" · "Testrender" · "Aktiveeri" · "Deaktiveeri" · "Uus versioon rakendub ainult uutele lepingutele".

## Permissions & audit
Audit-logged: void (reason + outcome), resend, template upload/version/activate/deactivate (reason), container download (contains personal data). Views not logged (list is aggregate).

## Placeholder catalogue — validation rules
- Every `{{token}}` in an uploaded template is checked against the catalogue; unknown → upload rejected with list.
- Required tokens per type: auction templates must contain `{{bidder.name}}`, `{{bidder.isikukood}}`-or-`{{bidder.registrikood}}`, `{{lot.id}}`, `{{lot.finalPrice}}`-or-`{{bid.amount}}`, `{{fee.total}}`; framework templates must contain `{{bidder.name}}`, `{{company.legalName}}`, `{{date.today}}`.
- Catalogue sidebar grouped (Pakkuja / Oksjon / Pakett / Tehing / Osapooled) with insert-at-cursor; search filter.
- `{{lot.packageTable}}` renders the step-6 table as DOCX table; empty rows omitted.

## Version lifecycle
| State | Meaning |
|---|---|
| draft | uploaded, not usable |
| aktiivne | used for new generations; one per type+scope |
| arhiivis | superseded; still resolvable for old contracts |

Upload → draft → [Testrender] (dummy data: Test Testov / Tamm OÜ 14309277 / lot #1 "Testmets", amount 61 000 €) → [Aktiveeri] (previous → arhiivis, typed reason optional but logged). Deactivate (no active) requires typed reason. Version history shows active-period + contracts generated per version count.

## Generation & signing flow states (visible per contract row)
prepared (PDF rendered, not yet sent) → saadetud (signing invitation sent, eID session ref shown) → allkirjastatud (signed_at, container hash, provider ref) → tühistatud. Stuck states surfaced: saadetud >7 days → amber "peatunud" + resend suggestion; provider errors → red retry.

## Edge cases
| Case | Behaviour |
|---|---|
| Void framework contract | prompts "Tühista ka pakkumisõigused?" → links 06 prefilled |
| Void auction contract with outcome void (superadmin) | lot returns to ended; re-winner flow via support (05 record annotated) |
| Template re-uploaded mid-ceremony | warning from 05 checklist still applies here (changed <24h banner) |
| Resend throttle exceeded | button disabled 60 min with countdown tooltip |

## Accessibility
Table focus/collapse consistent with 02; PDF viewer keyboard-navigable; placeholder sidebar is a listbox; version diff (test-render vs previous) offered as side-by-side images.

## Open questions
- Void of a signed framework contract — does it revoke bidding rights automatically? (Suggest: prompt to 06.)
- Estonian legal review pre-launch required for both template types (plan §1 legal posture).
- Multi-language contract templates (ET now, EN later) — scope field needs language axis?
