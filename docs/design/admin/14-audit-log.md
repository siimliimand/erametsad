# Auditlogi — Audit log viewer
| Area | admin |
|---|---|
| **Route** | `/audit` |
| **Access** | superadmin (full + export); admin (view own entries only) |
| **In nav** | sidebar "Auditlogi" (superadmin); hidden for others except self-view |

## Purpose & user goals
Immutable record of every consequential admin action. Investigate who changed what and when — rights changes, sealed openings, manual ends, impersonations, contract voids, settings changes, GDPR actions — with before/after evidence and controlled export.

## Wireframe (desktop)
```
┌───────────────────────────────────────────────────────────────────────────┐
│ Auditlogi  🔒 Kirjed on muutumatud — kustutamine ja muutmine pole võimalik │
│ Filtrid: [Tegija ▾][Tegevus ▾][Olem ▾][Kuupäev —] otsing: entity ID       │
├────────┬──────────┬──────────────────────┬────────────────┬───────────────┤
│Aeg     │ Tegija   │ Tegevus              │ Olem           │ Enne/Järel    │
│14:03:12│ M. Vain  │ sealed.winner_confirm│ Auction #4812  │  diff ▦      │
│14:02:58│ K. Mets  │ sealed.sign_approver │ Auction #4812  │  —           │
│11:40:03│ M. Vain  │ user.right_revoke    │ User #82       │  diff ▦      │
│09:12:44│ M. Vain  │ user.identity_view   │ User #79       │  —           │
├────────┴──────────┴──────────────────────┴────────────────┴───────────────┤
│ Detail (klikk):                                                            │
│ sealed.winner_confirm · Auction #4812 · 28.08 14:03:12                     │
│ Tegija: Marit Vain (admin) · sessioon a1f… · IP räsi 8f2e…                 │
│ ┌─ Enne ────────────────┬─ Järel ─────────────────┐                        │
│ │ "status":"ended",     │ "status":"contract",    │  ruumiline JSON-diff  │
│ │ "finalPrice":null     │ "finalPrice":61000      │  (punane/mustroheline)│
│ └───────────────────────┴─────────────────────────┘                        │
│ Põhjus: "Kontrollitud, võitja kinnitatud"   [Ekspordi kirje ▾]            │
└───────────────────────────────────────────────────────────────────────────┘
```

## Block-by-block spec
1. **Immutability banner** — permanent: "Kirjed on muutumatud". No edit/delete endpoints exist for this table; entries append-only (plan §8 integrity rules). Retention notice under it (see 6).
2. **Filter bar** —
   - Tegija: staff select (with "kõik"); admin role locked to self.
   - Tegevus: grouped dropdown — identiteet & õigused (user.identity_view, user.right_grant, user.right_revoke, user.suspend, user.ban, user.impersonate, user.gdpr_export, user.gdpr_delete), oksjonid (auction.create, auction.publish, auction.end_manual, auction.relist, auction.archive, auction.void), suletud avamine (sealed.sign_opener, sealed.sign_approver, sealed.reveal, sealed.winner_confirm, sealed.void), pakkumised (bid.approve, bid.reject, bid.export, anomaly.flag), lepingud (contract.void, contract.resend, contract.download_container, template.activate, template.deactivate, template.upload), ettevõtted (company.approve, company.reject), juhtlõimed (lead.assign, lead.status, lead.export, lead.delete), päringud (request.forward, request.close, partner.update), sisu (content.publish, content.restore, redirect.change, menu.publish, media.replace), seaded (settings.change, maintenance.start, flag.toggle), audit (audit.export).
   - Olem: entity type (User/Auction/Bid/Contract/Company/Lead/ServiceRequest/Setting).
   - Kuupäev: range. Freetext: entity_id exact.
3. **DataTable** — columns: Aeg (ms precision, Europe/Tallinn); Tegija (name + role chip); Tegevus (dotted key + Estonian label tooltip); Olem (type + id, link-out to module if applicable); Enne/Järel indicator (▦ if diff present); Põhjus (truncated). Sort aeg desc only. 100/page server-side; URL-shareable filters.
4. **Entry detail drawer** — header: action key, entity, timestamp; tegija + role + session id (short) + IP räsi (salted hash — raw IP never stored per 04); **Enne/Järel JSON diff viewer**: two-column side-by-side and unified toggle, colour-coded removed/added/changed lines, secret fields (reserve_price, keys) rendered "salajane — muudetud"; Põhjus text; reason mandatory actions show it; links: entity (opens module), actor (06). Per-entry [Ekspordi kirje] (JSON) — superadmin.
5. **Export** — superadmin only button [Ekspordi filtreeritud CSV]: full filtered set (not just page) as async job → download link 24h; export itself creates an `audit.export` entry (self-referential, visible). Admin self-view has no export.

## Interactions & edge cases
- Sealed-opening entries chain-link: drawer shows related entries of the same ceremony (opener → approver → reveal → confirm) as timeline mini-strip.
- Impersonation entries link the impersonated user and include duration.
- Very large diffs (settings matrices) collapse to summary + expand.
- Hash-chain integrity indicator in footer: "Ahela kontroll ✓ viimati 04:00" (daily Merkle check job; mismatch → superadmin alert, banner red).
- Keyboard: ↑/↓ rows, D opens diff.

## Data & API
`GET /api/admin/audit?actor=&action=&entity=&from=&to=&page=`; `GET /api/admin/audit/:id` (detail with before/after); `POST /api/admin/audit/export` (superadmin; async CSV job). Written to by every module per their audit notes. Append-only enforced at DB level (no UPDATE/DELETE grants on table to app role).

## States
Empty filter: "Filtritele vastavaid kirjeid ei leitud". Non-superadmin visiting: "Ainult superadmin" no-permission page, except self-entries view. Export pending: job spinner in topbar.

## Copy (Estonian, draft)
"Auditlogi" · "Kirjed on muutumatud — muuta ega kustutada ei saa" · "Tegija" · "Tegevus" · "Olem" · "Enne / Järel" · "Põhjus" · "Salajane väli — muudatus logitatud, väärtust ei näidata" · "Ekspordi filtreeritud" · "Ainult superadmin" · "Ahela kontroll" · "Säilitamine: 7 aastat, seejärel anonümiseerimine".

## Permissions & audit
The log itself: view (superadmin full / admin own), export superadmin (and the export is itself logged). Retention: entries retained 7 years then actor/IP-hash anonymised, business facts (what changed) retained — notice shown in UI.

## Entry types reference (full action registry)
| Group | Actions | Reason required | Diff |
|---|---|---|---|
| Identiteet & õigused | user.identity_view, user.right_grant, user.right_revoke, user.suspend, user.ban, user.force_logout, user.impersonate, user.gdpr_export, user.gdpr_delete | yes (except identity_view) | rights yes; enforcement yes; identity_view no |
| Oksjonid | auction.create, auction.publish, auction.schedule, auction.end_manual, auction.relist, auction.archive, auction.alias_regen | end/archive yes | yes (secret masked) |
| Suletud avamine | sealed.sign_opener, sealed.sign_approver, sealed.reveal, sealed.winner_confirm, sealed.void, sealed.mark_unsold | confirm/void yes | yes (amounts unmasked internal) |
| Pakkumised | bid.approve, bid.reject, anomaly.flag, bid.export | reject/export yes | approve/reject yes |
| Lepingud | contract.void, contract.resend, contract.download_container, template.upload, template.activate, template.deactivate | void/deactivate yes | template yes |
| Ettevõtted | company.approve, company.reject, company.hold, company.registry_view | reject yes | approve yes |
| Juhtlõimed | lead.create_manual, lead.assign, lead.status, lead.export, lead.delete | delete yes | status yes |
| Päringud | request.forward, request.close, request.mark_done, partner.create/update/deactivate | — | partner yes |
| Sisu | content.publish, content.schedule, content.restore, media.replace, redirect.create/delete, menu.publish | restore/redirect delete yes | yes |
| Seaded | settings.change, maintenance.start/cancel, flag.toggle, public_stats.change | all yes | yes (secrets excluded) |
| Audit | audit.export | — | — |

## Diff viewer details
Side-by-side and unified modes; JSON paths collapsible; changed-leaf highlighting; long values (rich text HTML) collapsed to "[HTML {n} tähemärki]" expandable; masked fields render `"<salajane>"` with tooltip "Väärtuse muutus logitatud, sisu ei salvestata". Copy-JSON button per side.

## Retention & integrity notice (UI text, draft)
"Säilitame auditlogi kirjeid 7 aastat. Pärast seda anonümiseeritakse tegija ja IP-räsi; äritehingute faktid jäävad. Logi on ahelatud (Merkle) ja igapäevaselt kontrollitakse terviklust. Kustutamine või muutmine pole võimalik."

## Edge cases
| Case | Behaviour |
|---|---|
| Entity deleted (soft) | entity link renders "#4810 (arhiivis)" — no dead link |
| Reason missing on legacy import | shown "põhjus puudub (imporditud)" for migrated data |
| Export of >100k rows | async job, chunked CSV, e-mail link when ready |
| Self-view admin sees impersonation of themselves | allowed view; no actor details beyond name+role |

## Accessibility
Table per 02 patterns; drawer focus-trapped; diff colours paired with +/- text markers (colourblind-safe); filter dropdowns searchable comboboxes.

## Entry anatomy (field list)
Aeg (ms) · Tegija (id, nimi, roll) · Sessioon (short id) · IP räsi (salted) · Tegevus (key) · Olem (type, id) · Enne (JSON) · Järel (JSON) · Põhjus (text) · Meta (user-agent family, impersonation parent entry id if nested). Entries written synchronously in the same transaction as the action they describe wherever possible.

## Open questions
- Deliver audit exports to an external WORM sink (daily) for stronger tamper evidence?
- Should sellers get a scoped self-audit view (their alapakkumine decisions)?
- Real-time audit tail (SSE) for superadmin awareness during ceremonies?
