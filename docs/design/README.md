# Eametsad — Design Files

One design spec per page/screen, covering **marketing site, auction portal (public + password-protected customer area), admin backend, and association subsite**.

```
docs/design/
├── README.md            ← you are here: shared design language + index
├── 00-global-shell.md   ← header, footer, contact band, cookie banner, error pages
├── marketing/           ← eametsad.ee (public)
├── portal/              ← oksjonid.eametsad.ee (public + logged-in customer pages)
├── admin/               ← admin.eametsad.ee (staff only, role-gated)
└── uhistu/              ← metsauhistu.eametsad.ee (association subsite, Phase 5)
```

Sources: `../EAMETSAD-PLAN.md` (master plan), `../research/*.md` (reference-site analysis).
⚠️ Reference sites were analyzed for **functionality only** — all Eametsad layouts, copy and brand assets below are original drafts.

---

## Shared design language (placeholder tokens until client brand work)

**Color**
| Token | Value | Use |
|---|---|---|
| `--primary` | `#2E6B4F` spruce green | primary buttons, links, accents |
| `--primary-dark` | `#16382A` deep forest | hero overlays, footers, headings |
| `--accent` | `#58B368` fresh green | highlights, active states, success |
| `--cta` | `#F2A93B` amber | main CTA buttons, price highlights |
| `--bg-mist` | `#F1F5F2` | alternating section background |
| `--ink` | `#1B211D` | body text |
| `--danger` | `#B3261E` | errors, destructive actions |
| `--info` | `#2D6FA8` | informational banners |
| status: active `#2E9E5B` · pending `#F2A93B` · ended/archived `#6B7570` | | auction status pills |

**Type**: Manrope 700/800 headings, Inter 400/500/600 UI & body. Scale: 48/36/28/22/18/16/14/12. Line-height 1.2 headings, 1.6 body.

**Layout**: 12-col grid, 1280px max container, 24px gutters. Section rhythm 96px (desktop) / 64px / 40px. Cards radius 14px, inputs & buttons 10px. Buttons: primary (solid green), cta (solid amber), secondary (outline green), ghost (text link). Soft shadow `0 2px 12px rgba(22,56,42,.08)` on cards only.

**Shared components** (referenced by page files as `<Comp>`): `Btn`, `Card`, `LotCard`, `FilterPanel`, `MapEstonia` (Leaflet + Maa-amet orthophoto), `Countdown`, `StatusPill`, `BidPanel`, `DataTable` (sort/filter/paginate), `Accordion`, `Tabs`, `Steps`, `EmptyState`, `FormInput/Select/Check/FileUpload`, `ConsentCheck` (visible, unchecked, required — never pre-checked), `SpecialistCard`, `AuctionTicker`, `ContactBand`, `LeadForm`, `CookieBanner`, `Toast`, `Modal`, `Drawer`.

**Icons**: Lucide set. **Imagery**: authentic Estonian forestry photography, 16:10, subtle `--primary-dark` gradient overlays on heroes.

---

## File template (every page file follows this exactly)

```markdown
# <Page title (Estonian)> — <English name>
| Area | marketing / portal / admin / uhistu |
|---|---|
| **Route** | URL pattern |
| **Access** | public / authed (which roles) / admin (which roles) |
| **In nav** | where this page is reached from |

## Purpose & user goals
(1–3 sentences: who lands here, what they must achieve)

## Wireframe (desktop)
(ASCII wireframe of the main layout; note mobile collapse below)

## Block-by-block spec
(numbered blocks top→bottom: content, components, behavior)

## Interactions & edge cases
(hover/click/keyboard behaviors, validation, confirmations)

## Data & API
(fields shown, endpoints, realtime updates, caching)

## States
(empty / loading / error / success / no-permission variants)

## Copy (Estonian, draft)
(H1, key labels, CTAs, error messages — draft strings)

## SEO & analytics   ← public pages only
(title/desc pattern, structured data, events)

## Open questions
```

---

## Page index

### 00 Global
- [00-global-shell.md](00-global-shell.md) — header/nav, footer, contact band, cookie banner, 404/500

### Marketing — `eametsad.ee`
| File | Page |
|---|---|
| [marketing/01-home.md](marketing/01-home.md) | Avaleht |
| [marketing/02-teenused-raieoiguse-muuk.md](marketing/02-teenused-raieoiguse-muuk.md) | Raieõiguse müük |
| [marketing/03-teenused-kinnistu-muuk.md](marketing/03-teenused-kinnistu-muuk.md) | Kinnistu müük |
| [marketing/04-teenused-metsa-hindamine.md](marketing/04-teenused-metsa-hindamine.md) | Metsa hindamine (+ SEO-article template) |
| [marketing/05-metsateatis.md](marketing/05-metsateatis.md) | Metsateatise juhend |
| [marketing/06-hindamisaktid.md](marketing/06-hindamisaktid.md) | Hindamisaktid |
| [marketing/07-kiiroksjon.md](marketing/07-kiiroksjon.md) | Kiiroksjon (48h) |
| [marketing/08-kkk.md](marketing/08-kkk.md) | KKK hub + category template |
| [marketing/09-paringud-hub.md](marketing/09-paringud-hub.md) | Päringud hub |
| [marketing/10-paringud-metsamajanduskava.md](marketing/10-paringud-metsamajanduskava.md) | Kava päring |
| [marketing/11-paringud-hooldusraie.md](marketing/11-paringud-hooldusraie.md) | Hooldusraie päring |
| [marketing/12-paringud-metsa-istutamine.md](marketing/12-paringud-metsa-istutamine.md) | Istutamise päring |
| [marketing/13-meist.md](marketing/13-meist.md) | Meist |
| [marketing/14-meist-metsaspetsialistid.md](marketing/14-meist-metsaspetsialistid.md) | Metsaspetsialistid + profiil |
| [marketing/15-artiklid.md](marketing/15-artiklid.md) | Artiklid hub + article template |
| [marketing/16-lepingud.md](marketing/16-lepingud.md) | Lepingud |
| [marketing/17-kontakt.md](marketing/17-kontakt.md) | Kontakt |

### Auction portal — `oksjonid.eametsad.ee`
| File | Page |
|---|---|
| [portal/01-listing.md](portal/01-listing.md) | Avaleht: tabs + map + filters |
| [portal/02-lot-detail-open.md](portal/02-lot-detail-open.md) | Avatud oksjon (detail + bidding) |
| [portal/03-lot-detail-sealed.md](portal/03-lot-detail-sealed.md) | Suletud pakkumine (detail + sealed bid) |
| [portal/04-ajalugu.md](portal/04-ajalugu.md) | Oksjonite ajalugu (archive) |
| [portal/05-login.md](portal/05-login.md) | Logi sisse |
| [portal/06-register.md](portal/06-register.md) | Registreerimine (private + company) |
| [portal/07-select-profile.md](portal/07-select-profile.md) | Profiili valik |
| [portal/08-update-password.md](portal/08-update-password.md) | Parooli muutmine / reset |
| [portal/09-user-bids.md](portal/09-user-bids.md) | 🔒 Minu pakkumised |
| [portal/10-user-objects.md](portal/10-user-objects.md) | 🔒 Minu müügid |
| [portal/11-user-notifications.md](portal/11-user-notifications.md) | 🔒 Teavitused + otsingute tellimine |
| [portal/12-user-profile.md](portal/12-user-profile.md) | 🔒 Minu profiil |
| [portal/13-contract-signing.md](portal/13-contract-signing.md) | 🔒 Lepingute allkirjastamine (raamleping + oksjonileping) |

### Admin — `admin.eametsad.ee`
| File | Screen |
|---|---|
| [admin/01-dashboard.md](admin/01-dashboard.md) | Töölaud |
| [admin/02-auctions-list.md](admin/02-auctions-list.md) | Oksjonid (list) |
| [admin/03-auction-editor.md](admin/03-auction-editor.md) | Oksjoni koostamine (wizard) |
| [admin/04-bids-monitoring.md](admin/04-bids-monitoring.md) | Pakkumiste jälgimine + alapakkumised |
| [admin/05-sealed-opening.md](admin/05-sealed-opening.md) | Suletud pakkumiste avamine |
| [admin/06-users.md](admin/06-users.md) | Kasutajad & õigused |
| [admin/07-company-approvals.md](admin/07-company-approvals.md) | Ettevõtte taotlused |
| [admin/08-contracts.md](admin/08-contracts.md) | Lepingud & mallid |
| [admin/09-leads-crm.md](admin/09-leads-crm.md) | Juhtlõimed (CRM) |
| [admin/10-service-requests.md](admin/10-service-requests.md) | Teenusepäringute suunamine |
| [admin/11-cms-content.md](admin/11-cms-content.md) | Sisuhaldus (pages/articles/FAQ) |
| [admin/12-statistics.md](admin/12-statistics.md) | Statistika |
| [admin/13-settings.md](admin/13-settings.md) | Seaded |
| [admin/14-audit-log.md](admin/14-audit-log.md) | Auditlogi |

### Association — `metsauhistu.eametsad.ee` (Phase 5)
| File | Page |
|---|---|
| [uhistu/01-home.md](uhistu/01-home.md) | Avaleht |
| [uhistu/02-teenused.md](uhistu/02-teenused.md) | Teenused |
| [uhistu/03-toetused-list.md](uhistu/03-toetused-list.md) | Toetused (list) |
| [uhistu/04-toetused-detail.md](uhistu/04-toetused-detail.md) | Toetuse lehekülg (template) |
| [uhistu/05-sertifitseerimine.md](uhistu/05-sertifitseerimine.md) | Sertifitseerimine |
| [uhistu/06-liitu.md](uhistu/06-liitu.md) | Liitu |
| [uhistu/07-kontakt.md](uhistu/07-kontakt.md) | Kontakt |
