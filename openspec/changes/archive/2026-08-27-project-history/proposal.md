# Project History — Erametsad

**Greenfield project — pre-development state**

- **Created:** 2026-08-27
- **Type:** Forest-transaction auction platform (Estonia)
- **Status:** Pre-implementation — fully specified, no code written yet

## What exists

1. **Master build plan** (`docs/ERAMETSAD-PLAN.md`, 464 lines) — complete spec covering marketing site, auction portal, admin backend, data model, API surface, delivery phases, and open client questions.
2. **Design system** (`docs/design/README.md`, 378 lines) — full design language: colour palette (16 tokens), typography (Manrope/Inter/JetBrains Mono), spacing scale (8 tokens), layout grid, motion, imagery, iconography (Lucide React), and component library (30+ components).
3. **Page specs** — 40+ page/screen specs across marketing (17 pages), portal (13 screens), admin (14 screens), and association subsite (7 pages).
4. **Competitive research** — structural analysis of timber.ee (3 sites, 23 pages, reverse-engineered APIs).
5. **Agent infrastructure** — OpenCode configured with guardrails, design, and architecture skills.
6. **Two git commits** — initial project setup and design-system documentation.

## Key decisions already made

- Tech stack: Next.js 15 + Payload CMS 3 + PostgreSQL 16 + Redis (recommended); Laravel alternative noted
- Subdomain strategy: `erametsad.ee`, `oksjonid.`, `api.`, `admin.`, optional `metsauhistu.`
- Revenue model: 3% + VAT success fee, valuation reports (from €480), 48h quick auctions
- Delivery: 5 phases, ~20-28 weeks full scope, ~10-12 weeks to MVP
- Design philosophy: calm, authentic Estonian forest, trustworthy, accessible (WCAG 2.1 AA)
- eID: Smart-ID / Mobile-ID / ID-card via aggregator (eID Easy recommended)
- Maps: Leaflet + Maa-amet orthophoto
- Monorepo with Turborepo/pnpm

## Open constraints

- Legal entity name and registry code not yet decided (client decision)
- eID/signing provider contracts not yet signed
- Buyer network not yet established
- Client brand assets pending (logo, palette)