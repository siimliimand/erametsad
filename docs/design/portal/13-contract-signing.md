# Lepingute allkirjastamine — Contract signing (raamleping + oksjonileping)

> **In brief:** Review and electronically sign the framework and auction contracts.
| Area | portal |
|---|---|
| **Route** | `/lepingud/raamleping?next=…` (framework, once) · `/lepingud/oksjonileping/:auctionId` (per won auction) · `/lepingud` (list of my contracts) |
| **Access** | authed (any profile that can bid) |
| **In nav** | bid-submit gate on open auctions; winner e-mail CTA; user profile "Lepingud" card |

## Purpose & user goals
Two gating flows: (a) sign the framework contract (raamleping) once before the first open bid; (b) after winning, sign the per-auction contract generated from lot + bid data, then download the signed container. Full-page step flow, never a modal (signing is legally significant).

## Wireframe (desktop)
```
┌───────────────────────────────────────────────────────────────┐
│ RAAMLEPING      ●──────○──────○──────○   Allkirjastamine 2/4  │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Steps: 1 Andmed → 2 Kontroll → 3 Allkiri → 4 Valmis        │ │
│ │ ┌───────────────┬───────────────────────────────┐         │ │
│ │ │ Pakkuja andmed│  [PDF eelvaade - inline viewer]│         │ │
│ │ │ nimi, ik,     │  Raamleping v1.2 · lk 1/4     │         │ │
│ │ │ aadress, mail │  [Laadi alla PDF]             │         │ │
│ │ │ [JÄTKA]       │  [ AVA ALLKIRJASTAMISEKS ]    │         │ │
│ │ └───────────────┴───────────────────────────────┘         │ │
│ │ STATUSRIUL: ✓ Koostatud → ● Ootab allkirja → ○ Allkirjastatud│
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```
Mobile: steps vertical; PDF preview opens full-screen viewer (or download prompt); e-sign control-code screen identical.

## Block-by-block spec
1. **Steps header** — `<Steps>`: 1 Andmed → 2 Kontroll → 3 Allkiri → 4 Valmis. Progress persisted; re-entry resumes.
2. **Flow (a) raamleping:**
   - **1 Andmed**: identity form (Pakkuja nimi, isikukood/registrikood 11/8 digits, aadress, e-mail, telefon) — prefilled from profile; editable snapshot.
   - **2 Kontroll**: server prepares PDF (`POST /api/bids/framework-contract/prepare`) → inline PDF viewer (first page thumbnail, "Laadi alla PDF" for full review); user must check "Olen dokumendi läbi lugenud" to continue.
   - **3 Allkiri**: `POST` to signing provider — **eID Easy (placeholder provider)** with Smart-ID / Mobiil-ID / ID-kaart method picker → control-code screen (same pattern as login: "Kontrolli koodi telefonis, sisesta PIN2") → poll provider status → `POST /api/bids/framework-contract/complete` with signature → container stored on profile.
   - **4 Valmis**: "Raamleping on allkirjastatud." + redirect back to `next` (the blocked bid) with CTA "Jätka pakkumisega".
3. **Flow (b) oksjonileping:** entered from winner notification. No identity step (data from winning bid + lot auto-filled); template renders lot name, katastrid, summa (finalPrice), teenustasu, tähtajad. Steps 2–4 as above via `POST /api/bids/contract/prepare|complete`. Valmis adds "Laadi allkirjastatud fail (.bdoc/.asice)" download.
4. **Signature status timeline** — component on every signing page + `/lepingud` list: Koostatud → Saadetud allkirjastamisele → Allkirjastatud (kuupäev) → (Lõpetatud/tühistatud). States from Contract.status: prepared / sent / signed / voided.
5. **/lepingud list** — table: tüüp (Raamleping/Oksjonileping), oksjon (link), versioon, staatus pill, allkirjastatud, tegevus (Vaata/Laadi/Jätka).

## Interactions & edge cases
- Gate logic: open-auction bid submit checks signed raamleping for the active profile; absence → redirect here with `next`; return auto-focuses the bid panel.
- Already-signed raamleping: flow (a) skips to Valmis ("Sul on raamleping jõus alates {date}") — no re-signing on template version bump (new versions apply to future contracts only).
- Provider timeout / user cancels: "Allkirjastamine katkestati. Proovi uuesti." — contract stays `sent`, resume allowed.
- Expired provider session (15 min): re-prepare; drafts invalid.
- Error/timeout handling: 3 failed attempts → "Allkirjastamine ei õnnestu? Võta ühendust info@erametsad.ee."
- Voided contract (admin or template error): timeline shows "Tühistatud" + explanation + new prepare CTA.
- Winner contract deadline: countdown chip "Allkirjasta {frist} — vastasel juhul läheb oksjon järgmisele pakkujale."
- Mobile signing often on same phone as Smart-ID app: show tip "Vaheta seadet või kasuta Mobiil-ID-d, kui Smart-ID rakendus ühel ekraanil ei mahtu."

## Data & API
| Action | Endpoint |
|---|---|
| framework prepare/complete | `POST /api/bids/framework-contract/prepare` · `/complete` |
| auction contract prepare/complete | `POST /api/bids/contract/prepare` · `/complete` |
| my contracts list | `GET /api/contracts` |
| PDF / container | signed URLs from contract record; hash audit-logged |
| provider | eID Easy signing API (client-side redirect + callback / poll) — placeholder, swap-compatible (Dokobit/Signicat) |
No caching (authed). No realtime (status polling of provider).

## States
- Steps 1–4 per flow; prepared (PDF ready, unchecked) / sent (awaiting signature, control-code screen) / signed (timeline ✓ + downloads) / voided.
- Pending-approval profile attempting to sign: blocked "Ettevõtte profiil pole veel kinnitatud."
- Provider down: banner "Allkirjastamise teenus ei ole saadaval — proovi varsti uuesti."
- Guest hitting URL: redirect `/login?next=…`.

## Copy (Estonian, draft)
"Raamleping" · "Oksjonileping" · "Sisesta enda andmed lepingu koostamiseks, tutvu dokumendiga ja allkirjasta see." · "Olen dokumendi läbi lugenud" · "Ava allkirjastamiseks" · "Kontrolli, et telefonis kuvatakse sama koodi, seejärel sisesta PIN2." · "Raamleping on allkirjastatud." · "Leping on allkirjastatud — laadi fail alla." · "Allkirjastamine katkestati. Proovi uuesti." · "Leping tühistati." · "Jätka pakkumisega"

## Open questions
- Which contract does a sealed-bid winner sign — same oksjonileping template with `type: auction`? (Assumed yes.)
- Two-signatory case (company representative + counterparty Erametsad): show counter-signature pending state in timeline? (Recommend yes: "Ootab Erametsadi vastuallkirja".)
- Provider choice confirmation (eID Easy pricing) — Phase 0.
