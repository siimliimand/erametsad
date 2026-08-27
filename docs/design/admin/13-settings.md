# Seaded — Settings (superadmin)

> **In brief:** Fees, anti-snipe defaults, notification templates and maintenance mode.
| Area | admin |
|---|---|
| **Route** | `/seaded` (sections: Üldine / Tasud / Oksjonid / Teavitused / Integratsioonid / Rollid / Hooldus / Lipud) |
| **Access** | superadmin (all); admin read-only except teavituste mallid |
| **In nav** | sidebar "Seaded" |

## Purpose & user goals
Central configuration for the whole platform: identity defaults, fees, auction mechanics defaults, notification templates, integration credentials, role matrix, maintenance windows, feature flags. Every change is audit-logged with before/after.

## Wireframe (desktop)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ Seaded   ⚠ Muudatused jõustuvad kohe ja logitakse auditisse             │
├──────────────┬───────────────────────────────────────────────────────────┤
│ § Üldine     │ § Tasud                                                  │
│ § Tasud      │ Vaikimisi teenustasu [%]: [3.0]                          │
│ § Oksjonid   │ KM määr [%]: [22]   Arve: [□ kaasata KM rida]            │
│ § Teavitused │ Kiiroksjoni tasu erisus [%]: [3.0]                       │
│ § Integratsioonid │ Hindamisakti hinnakiri … (viide CMS-i)              │
│ § Rollid     │                                   [Salvesta: põhjendus ⚠]│
│ § Hooldus    ├───────────────────────────────────────────────────────────┤
│ § Lipud      │ § Oksjonid: anti-snipe [5] min · automaatpakkuja [✓] …  │
└──────────────┴───────────────────────────────────────────────────────────┘
```

## Block-by-block spec
1. **Üldine** — ettevõtte andmed (juriidiline nimi, registrikood, KMKR, aadress — feeds contract placeholders), alias e-posti domeen (`oksjonid.eametsad.ee`, validation: DNS MX check button), vaikimisi ajavöönd (locked Europe/Tallinn), toetus-e-post/telefon.
2. **Tasud** — vaikimisi teenustasu % (decimal, 0–10), KM määr %, kiiroksjoni erinev tasu, min tasu € (optional floor), näidis-arvutus live: "100 000 € → tasu 3 000 € + KM 660 €". Per-lot overrides remain in 03.
3. **Oksjonid** — anti-snipe vaikimisi minutid (1–30) + lubatud vahemik; automaatpakkuja sisse/välja (globaalne gate); alapakkumine: vaikimisi lubatud/lubamata uutel lottidel + müüja kinnitamise tähtaeg päevades; min oksjoni kestus; kiiroksjoni kestus (default 48h, allowed 24–72); sulenud pakkumiste paranduste arv (N revisions, default 0); kahe-osalise avamise reegel (kinnitaja roll: superadmin / teine admin).
4. **Teavitused** — mallide editor: list of templates per event (new-matching-lot, outbid, won, lost, ending-24h, alapakkumine-decision, company-approved/rejected, contract-ready, kiiroksjon-result) × channel (e-post, SMS). Editor: subject + body, variable inserter ({{user.name}}, {{lot.name}}, {{amount}}, {{endTime}}, …), test-send to own address (uses dummy data), versioon + viimati muudetud. SMS counter (160-char segments).
5. **Integratsioonid** — cards each: eID/allkirjastus (eID Easy), Äriregister, e-post (Mailgun), SMS (Messente), kaardid (LMV — keyless, status only). Per card: olek ●, viimane kontroll, **võtmed maskitud** (`sk-…••••4f2a`), rotate-väli (write-only), "Testi ühendust" button. Key values never rendered after save.
6. **Rollid** — rollide nimistu (specialist, seller, admin, superadmin) + **vaikimisi õiguste maatriks**: read õigus (module/action), columns roles, checkbox matrix; per-role module visibility (which sidebar items render). Also: company-approval default rights set (which auction types auto-granted in 07); anomaly-heuristic thresholds (04); lead auto-assignment on/off + round-robin list order.
7. **Hooldus** — hooldusrežiim: planeeri aken (algus—lõpp) + koht: "Näita hooldusteateid ainult portaalis / kõigil saidil"; **konflikti hoiatus**: scheduler lists auctions ending inside the window (blocks saving until shifted or force-confirmed "Mõjutatud oksjoneid: 2 — jätkan siiski"); hoolduslehe tekst (rich). Manual "Alusta kohe" with typed reason.
8. **Lipud (feature flags)** — toggle list with keys: `sealed_bids`, `sms_notifications`, `saved_search_digests`, `map_view`, `statistics_public`, `quick_auction`, `partner_portal`; each with description, roll (kasutajatele %-positsioneerimine ei ole vajalik — binäärne), muutmise põhjendusväli.

## Interactions & edge cases
- Every section save requires a **põhjendus (reason) field**; save writes audit entry with before/after JSON (secrets excluded, logged as "muudetud").
- Fee % change does NOT retro-affect active auctions (banner clarifies: "Kehtib uutele oksjonidele").
- Anti-snipe change: default only; existing lots keep their per-lot value.
- Maintenance window conflict check re-validates on save (race with newly scheduled lots).
- Role matrix self-lockout guard: removing superadmin's own "Seaded" right is blocked.
- Test-send never sends to real users; uses current superadmin address.

## Data & API
`GET /api/admin/settings`, `PATCH /api/admin/settings/:section {changes, reason}` (server validates ranges, re-checks conflicts); integrations: `PATCH :id/keys` (write-only), `POST :id/test`; maintenance: `POST /api/admin/maintenance/schedule|start|cancel`. All `settings.change` audit entries.

## States
Read-only mode for admin: fields disabled + banner "Muutmise õigus puudub". Integration test spinner → green/red result. Unsaved-changes guard on section switch.

## Copy (Estonian, draft)
"Seaded" · "Muudatused logitakse auditisse" · "Põhjendus (kohustuslik)" · "Vaikimisi teenustasu" · "Automaatselt pikeneva lõpu minutid" · "Alapakkumise kinnitamise tähtaeg" · "Testi ühendust" · "Võtmed on varjatud" · "Hooldusrežiim" · "Hoolduse aken kattub oksjonide lõppudega" · "Kehtib uutele oksjonidele" · "Näidisarvutus" · "Kinnitaja roll suletud avamisel".

## Permissions & audit
Most audit-sensitive module: every save logs actor, section, before/after (masked secrets), reason. Superadmin only, except notification-template editing (admin) and viewing general info.

## Section field inventories (summary tables)
**Üldine**: juriidiline nimi*, registrikood* (8 numbrit), KMKR, aadress, toetus e-post*, toimus telefon*, alias domeen* (MX-check), KM-arve saatja andmed.
**Oksjonid**: anti-snipe min [1–30, def 5] · automaatpakkuja lubatud ☐ · alapakkumine lubatud ☐ + otsustähtaeg päevades [1–14, def 3] · min kestus h [def 1] · kiiroksjon kestus h [24–72, def 48] · suletud paranduste arv [0–5, def 0] · kinnitaja roll (superadmin | teine admin).
**Rollid maatriks read** (näidis): users.view, users.rights.change, users.ban, impersonate, auctions.manage, auctions.end_manual, sealed.open, sealed.approve, contracts.manage, contracts.void, templates.manage, leads.view_all, leads.export, partners.manage, cms.publish, stats.export, settings.change, audit.view_all, audit.export — columns: specialist / seller / admin / superadmin.
**Lipud kirjeldused**: iga lipu juhus üherealine selgitus + eeldatav mõju (nt "sms_notifications — lülitab SMS saatmise kogu süsteemis välja; e-kiri jääb").

## Notification template variables (shared catalogue)
`{{user.name}}`, `{{user.email}}`, `{{profile.name}}`, `{{lot.name}}`, `{{lot.id}}`, `{{lot.endTime}}`, `{{lot.aliasEmail}}`, `{{amount}}`, `{{step}}`, `{{company.name}}`, `{{reason}}`, `{{contract.link}}`, `{{finalPrice}}`. Variable list per event shown in editor; unknown tokens flagged on save.

## Maintenance mode behaviour detail
- Window create: list of colliding auctions computed live (id, name, endTime) — save blocked while any collision unless "jätkan siiski" + typed reason.
- During window: portal shows hooldusleht (est. text), admin stays functional; running auctions keep their clocks (ending worker paused? — NO: endings still processed; only customer writes are blocked) — clarified in UI: "Pakkumiste esitamine on keelatud, lõpetamistööd jätkuvad".
- Auto-end of window + manual "Lõpeta hooldus" (logged).

## Secrets handling
Keys accepted via write-only inputs; stored encrypted at rest; rendered only as mask + last 4; rotation = new value + immediate test-button suggestion; audit logs record "key rotated" never the value. Env-var mode indicator if keys managed outside DB.

## Accessibility & guardrails
All inputs labelled; % fields with unit suffix; destructive toggles (maintenance, flags off) require typed keyword; unsaved-changes guard on section switch; admin read-only view disables inputs with explanatory banner.

## Teavitused section detail
Template list rows: sündmus · kanal (e-post/SMS) · versioon · viimati muudetud · aktiivne. Editor drawer: subject (e-post only), body (monospace textarea with variable inserter), char counter + SMS segment counter, [Saada test endale], [Salvesta uue versioonina] (põhjendusväli). Version history per template with restore.

## Hooldus section detail
- Aknad table: algus, lõpp, ulatus (portaal / kõik), olek (planeeritud/käimas/lõppenud), looja.
- [Lisa aken] opens datetime range + collision preview (live list of endings inside window).
- Manual start: immediate, typed reason, broadcast to admins via bell.
- Hoolduslehe tekst: rich text with {contact} token.

## States (full)
- Save blocked (validation): inline errors per field; reason field empty blocks all saves.
- Integration test pending: per-card spinner → "OK (212 ms)" / "Nurjus: {põhjus}".
- Self-lockout guard message: "Seda õigust ei saa endalt eemaldada".
- Admin read-only banner: "Muutmise õigus puudub — teavita superadminit".

## Rollid section detail (matrix interactions)
- Checkbox grid; changing a checkbox marks the row dirty; save-all writes one audit entry with full before/after matrix.
- Hovering a cell shows the permissions it grants as a tooltip ("sealed.open — näeb ja avab suletud pakkumisi (05)").
- Preset buttons: "Vaikimisi soovitus" (plan §5.1 matrix) / "Kõik õigused superadminile" sanity restore.
- Sidebar rendering preview: mini mock of the shell showing which icons appear for the selected role.

## Open questions
- Staged settings (propose → second superadmin approves) for fee changes — overkill at launch?
- Fee history reporting for finance (audit log suffices or dedicated table)?
- Alias domain per object type (mt/hl prefixes like reference) — convention documented in settings help text?
