# Admin Screen Inventory

Scope: per-collection roles, day-to-day fields, operations, and screen
grouping for admin UI tasks 7.2-7.7. Prototype: single operator (admin).

---

## 1. Auctions screen (tasks 7.2-7.3)

**auctions** — admin (create, full update, delete). specialist (create, update own).
- Fields: title, slug, status, objectType, type, isQuickAuction, countyId,
  parishId, address, species, minBidCents, bidStepCents, startsAt, endsAt,
  descriptionPublic, media, cadastres, deadlines.
- Ops: create draft, edit (status transitions, pricing, dates), list
  (filter by status, objectType), delete (admin only).

**auction-subscriptions** — admin read-only. Users manage own.
- Fields: userId, filterJson, channel, frequency, status.
- Ops: view list. No admin CRUD in prototype.

**bids** — admin (read all, update status). Users see own.
- Fields: auctionId, userId, amountCents, type, source, status.
- Ops: list (filter by auction, status). Approve/reject pending_approval.

---

## 2. Users screen (task 7.4)

**users** — admin (read, update). System creates via registration.
- Fields: email, name, role, phone, status, authMethod.
- Sensitive (view-only): isikukoodEncrypted, passwordHash.
- Ops: list (filter by role, status), edit role and status.

**profiles** — admin (read, update, delete). Users manage own.
- Fields: type, approvalStatus, companyName, companyRegCode, displayName,
  phone, consentAt fields.
- Ops: list pending approvals, approve/reject company profiles.

---

## 3. Contracts screen (task 7.5)

**contracts** — admin (create, update, delete). Authenticated read.
- Fields: templateId, lotId, status, signedAt, signedBy, renderedHtml.
- Ops: create from template, update status, void, list (filter by lot, status).

**contract-templates** — admin (create, update, delete). Public read.
- Fields: name, type, version, placeholders, docxFileId, active.
- Ops: create, edit, activate/deactivate (hook disables prior active).

---

## 4. Content CMS (task 7.6)

**articles** — admin CRUD. Fields: title, slug, excerpt, content,
  featuredImageId, author, publishedAt, tags, status.

**pages** — admin CRUD. Fields: title, slug, layout, seoTitle,
  seoDescription, publishedAt, status.

**faq-categories + faq-items** — admin CRUD. Categories: title, slug, order.
  Items: question, answer, categoryId, order.

**testimonials** — admin CRUD. Fields: name, role, content, avatarId, featured.

**partner-services** — admin CRUD. Fields: name, slug, description, icon,
  link, order, active.

**legal-documents** — admin CRUD. Fields: title, slug, type, content,
  version, effectiveDate, publishedAt, status.

All CMS collections: admin write, public read.

---

## 5. Operations screens

**leads** — admin CRUD. Fields: formName, contactName, phone, email,
  cadastr, status, assignedSpecialistId, internalComment.
- Ops: list (filter by status, specialist), assign, update status.

**company-access-request** — admin (read, update). Users create.
- Fields: regCode, companyName, requesterName, reason, status.
- Ops: list pending, approve/reject.

**specialists** — admin CRUD. Fields: name, slug, role, phone, email,
  photoId, bio, region, active, featured.

---

## 6. Settings (task 7.7)

**settings** (singleton) — admin update. Fields: orgName, orgRegCode,
  orgAddress, feePercent, vatPercent, antiSnipeDurationMinutes,
  alapakkumineEnabled, sealedRevisionCap, featureFlags.

---

## 7. Read-only screens

**audit-entry** — admin read. System creates. Fields: actorId, action,
  entityType, entityId, before, after. Ops: list (filter by entity, date).

**statistics-snapshots** — admin CRUD. Public read. Fields: date,
  objectType, count, area, volume, eurCents. Ops: list (filter by date).

**notifications** — admin read. System creates. Fields: userId, event,
  channel, title, body, readAt, sentAt. Ops: list (filter by user, event).

---

## 8. No admin screen (prototype)

- **redirects** — seed only, no day-to-day edits.
- **counties + parishes** — seed only (15 + ~79 rows).
- **autobidders** — user-managed, admin reads for debugging.
- **auction-rights** — admin creates within auction flow, no standalone screen.
- **media** — inline uploads on other screens, no standalone library.

---

## Screen summary

| Screen | Collections | Primary role |
|--------|------------|--------------|
| Auctions | auctions, subscriptions, bids | admin, specialist |
| Users | users, profiles | admin |
| Contracts | contracts, templates | admin |
| Content CMS | articles, pages, faq-*, testimonials, partner-services, legal-documents | admin |
| Operations | leads, company-access-request, specialists | admin |
| Settings | settings | admin |
| Audit log | audit-entry | admin (read) |
| Statistics | statistics-snapshots | admin |
| Notifications | notifications | admin (read) |

No screen: redirects, counties, parishes, autobidders, auction-rights, media.
