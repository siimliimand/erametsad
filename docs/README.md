# Eametsad — Project documentation

> **Plain-language guide for everyone.** Whether you're the forest-owner client, a buyer, or a developer joining the team, this is your starting point.

Eametsad is a new online service for Estonia that lets forest owners **sell cutting rights (_raieõigus_) and forest properties (_metsakinnistu_) by auction**, and lets vetted buyers bid on them. Around the auction itself we are building three connected products: the marketing and sales website, a secure customer area for bidding and selling, and an internal staff tool — all designed to feel calm, modern and trustworthy.

---

## What are we building?

Three websites, one shared brand and one shared system behind them:

| Website | Who it is for | What it does |
|---|---|---|
| `eametsad.ee` | Forest owners & buyers (public) | The shop window: explains the service, captures leads, answers questions, builds trust. |
| `oksjonid.eametsad.ee` | Bidders & sellers (logged-in) | The auction platform: browse lots on a map, place bids, sell your own forest, sign contracts. |
| `admin.eametsad.ee` | Eametsad staff | The control room: manage auctions, bidders, leads, contracts, content and statistics. |

A fourth site — `metsauhistu.eametsad.ee`, a forest-owners' association — is planned as an optional later phase.

---

## How the experience works, end to end

1. **A forest owner lands on the website**, reads how selling works, and leaves their contact details for a free consultation.
2. **A specialist calls back**, arranges a free consultation and prepares the forest for sale.
3. **The lot is published** on the auction platform — either an open ascending auction (for cutting rights) or a sealed "closed envelope" bid (for properties).
4. **Buyers place bids.** Cutting-right bidders sign a framework agreement first; an optional auto-bidder and anti-sniping rules keep the auction fair.
5. **The winner signs the contract** electronically (Smart-ID / Mobile-ID / ID-card) and the deal completes.
6. **Eametsad earns a success fee — 3% + VAT of the final price — only when the sale succeeds.** There is no cost to the seller if the auction does not complete.

Two additional revenue streams sit alongside the auction: **valuation reports** (from €480 + VAT) and **48-hour quick auctions** (_kiiroksjon_) where Eametsad itself backs the lot with a purchase offer if no buyer wins.

---

## What is in this folder?

| Document | What it is | Who should read it |
|---|---|---|
| `EAMETSAD-PLAN.md` | The master build plan — features, architecture, data model, timeline. Technical but opens with a plain-language summary. | Everyone; developers in detail |
| `design/README.md` | The shared design language — colours, type, components, motion, imagery — plus an index of every page. | Designers, developers, client (for brand feel) |
| `design/**/*.md` | One spec per page or screen, across all four areas. | Designers & developers |
| `research/*.md` | Competitive analysis of the reference service (timber.ee) — what it does, and what we adopt or avoid. | Background; client context |

---

## Where should I start?

1. **If you're the client** — read the plain-language summary at the top of `EAMETSAD-PLAN.md`, then skim `design/README.md` to see the intended look and feel.
2. **If you're a designer** — start at `design/README.md`, then the relevant page specs in `design/marketing/`.
3. **If you're a developer** — read `EAMETSAD-PLAN.md` end to end, then `design/` for the screens you will build.

---

## Key numbers at a glance

| Item | Value |
|---|---|
| Success fee (cutting rights & properties) | **3% + VAT** of final price, only on success |
| Valuation report (_hindamisakt_) | **from €480 + VAT** |
| Quick auction (_kiiroksjon_) | **48 hours**, €1 start, house backup offer |
| Delivery to a sellable MVP | **~10–12 weeks** |
| Full scope (all phases) | **~20–28 weeks** |
| Product language | **Estonian** (English/Russian ready later) |

---

## Decisions we need from you

The plan ends with a full list of open questions; the most important ones for the client are:

1. The **legal entity** behind Eametsad (name, registry code, VAT number).
2. The **fee model** — confirm the 3% + VAT success fee, and whether deposits are wanted.
3. The **eID & e-signing provider** (recommendation: eID Easy).
4. The **buyer network** — who will provide the demand side (this is what makes auctions succeed).
5. **Brand assets** — do we design the logo and palette fresh, or is there existing material?

---

## Working language

The product itself is written in **Estonian**; these documents are written in English for the delivery team, keeping Estonian only where it names a real product label (e.g. _raieõigus_, _pimepakkumine_). A fully Estonian version of the client-facing summary can be produced on request.
