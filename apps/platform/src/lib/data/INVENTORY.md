# Payload Local API Inventory

Scope: `apps/platform/src/**` (seed files excluded from call-site counts).
Generated from branch `feature/option-b-cloudflare-only`.

---

## 1. Call-site table by collection

### auctions

| Operation | Files | Options |
|-----------|-------|---------|
| find | `lib/bidding/sealed-opening.ts` (×3) | `where: { id: { equals } }`, `limit: 1`, `depth: 0` |
| find | `lib/bidding/sealed-bid.ts` | `where: { id: { equals } }`, `limit: 1`, `depth: 0` |
| find | `lib/bidding/autobidder.ts` | `where: { id: { equals } }`, `limit: 1`, `depth: 0` |
| find | `lib/workers/auction-ending.ts` | `where: { and: [status=active, endsAt ≤ now] }`, `limit: 100`, `depth: 0` |
| find | `lib/contracts/service.ts` | `where: { id: { equals } }`, `limit: 1`, `depth: 1` |
| find | `app/api/v1/my-auctions/…/approve/route.ts` | `where: { id: { equals } }`, `limit: 1`, `depth: 0` |
| find | `app/api/v1/my-auctions/…/reject/route.ts` | `where: { id: { equals } }`, `limit: 1`, `depth: 0` |
| findByID | `lib/workers/auction-ending.ts` (×2) | `depth: 0` |
| update | `lib/bidding/sealed-opening.ts` (×4) | `id`, `data: { status }` |
| update | `lib/bidding/anti-snipe.ts` | `id`, `data: { endsAt }` |
| update | `lib/workers/auction-ending.ts` (×3) | `id`, `data: { status, endedAt/winningBid }`, `depth: 0` |

### bids

| Operation | Files | Options |
|-----------|-------|---------|
| find | `lib/bidding/sealed-opening.ts` | `where: { and: [auction=, id≠, status=leading] }`, `limit: 1000`, `depth: 0` |
| find | `lib/bidding/sealed-bid.ts` (×3) | `where: { and: [auction=, type=sealed] }` / `where: { and: [auction=, user=, type=sealed, status≠rejected] }` / `where: { idempotencyKey: { equals } }`, `limit: 1–100`, `depth: 0` |
| find | `lib/bidding/autobidder.ts` | `where: { and: [auction=, status=leading] }`, `limit: 1`, `depth: 0` |
| find | `lib/bidding/place-bid.ts` (×2 via findDoc) | `where: { and: [auction=, status=leading] }` / `where: { idempotencyKey: { equals } }`, `limit: 1` |
| find | `lib/bidding/alapakkumine.ts` (×2 via findDoc) | `where: { id: { equals } }` / `where: { and: [auction=, status=leading] }`, `limit: 1` |
| find | `lib/workers/auction-ending.ts` | `where: { and: [auction=, status=leading] }`, `limit: 1`, `depth: 0` |
| create | `lib/bidding/sealed-bid.ts` | `data` |
| update | `lib/bidding/sealed-opening.ts` (×N) | `id`, `data: { status }` |
| update | `lib/bidding/sealed-bid.ts` (×N via Promise.all) | `id`, `data: { status: outbid }` |

### users

| Operation | Files | Options |
|-----------|-------|---------|
| find | `app/api/v1/auth/login/route.ts` (×2) | `where: { email: { equals } }` or `where: { isikukoodHash: { equals } }`, `limit: 1`, `depth: 1` |
| find | `app/api/v1/auth/forgot-password/route.ts` (×2) | same as login, `depth: 0` |
| find | `lib/auth/eid-provider.ts` | `where: { isikukoodHash: { equals } }`, `limit: 1`, `depth: 1` |
| create | `app/api/v1/auth/register/route.ts` | `data` (email, password, role, authMethod, status) |
| findByID | `lib/notifications/service.ts` | `id`, `depth: 0` |

### profile

| Operation | Files | Options |
|-----------|-------|---------|
| find | `lib/auth/profile-scope.ts` | `where: { and: [id=, user=] }`, `limit: 1`, `depth: 0` |
| create | `app/api/v1/auth/register/route.ts` | `data` (type, user, displayName, consentAt fields, company fields) |

### contract-templates

| Operation | Files | Options |
|-----------|-------|---------|
| find | `lib/contracts/service.ts` | `where: { and: [type=, active=true] }`, `limit: 1`, `depth: 0` |
| find | `lib/bidding/contract-gate.ts` | `where: { and: [type=, active=true] }`, `limit: 100`, `depth: 0` |
| find | `lib/bidding/place-bid.ts` (via findDoc) | `where: { and: [type=, active=true] }`, `limit: 1` |
| find | `payload/collections/ContractTemplate.ts` (hook) | `where: { and: [type=, active=true, id≠] }`, `limit: 100` |
| update | `payload/collections/ContractTemplate.ts` (hook) | `id`, `data: { active: false }` |

### contracts

| Operation | Files | Options |
|-----------|-------|---------|
| find | `lib/contracts/service.ts` (×2) | `where: { id: { equals } }`, `limit: 1`, `depth: 0` |
| find | `lib/bidding/contract-gate.ts` | `where: { and: [signedBy=, status=signed, template in] }`, `limit: 1`, `depth: 0` |
| find | `lib/bidding/place-bid.ts` (via findDoc) | `where: { and: [signedBy=, status=signed, template=] }`, `limit: 1` |
| create | `lib/contracts/service.ts` | `data` |
| update | `lib/contracts/service.ts` (×2) | `id`, `data: { status }` |

### settings

| Operation | Files | Options |
|-----------|-------|---------|
| find | `lib/bidding/sealed-bid.ts` | `limit: 1`, `depth: 0` (singleton, no where) |
| find | `lib/bidding/anti-snipe.ts` | `limit: 1`, `depth: 0` (singleton) |
| find | `lib/bidding/contract-gate.ts` | `limit: 1`, `depth: 0` (singleton) |
| find | `lib/bidding/place-bid.ts` (via findDoc) | `limit: 1` (singleton) |

### autobidders

| Operation | Files | Options |
|-----------|-------|---------|
| find | `lib/bidding/autobidder.ts` | `where: { and: [auction=, status=active] }`, `sort: 'createdAt'`, `depth: 0` |
| find | `app/api/v1/auto-bidders/route.ts` | `where: { and: [user=, auction=] }`, `limit: 1`, `depth: 0` |
| create | `app/api/v1/auto-bidders/route.ts` | `data` |
| update | `app/api/v1/auto-bidders/route.ts` | `id`, `data` |

### auction-rights

| Operation | Files | Options |
|-----------|-------|---------|
| find | `lib/bidding/sealed-bid.ts` | `where: { and: [user=, objectType=, revokedAt exists false] }`, `limit: 1`, `depth: 0` |
| find | `lib/bidding/place-bid.ts` (via findDoc) | `where: { and: [user=, objectType=, revokedAt exists false] }`, `limit: 1` |

### notifications

| Operation | Files | Options |
|-----------|-------|---------|
| create | `lib/notifications/service.ts` (×3 dispatch channels) | `data` |

### notification-preferences

| Operation | Files | Options |
|-----------|-------|---------|
| find | `lib/notifications/service.ts` | `where: { user: { equals } }`, `limit: 1` |

### statistics-snapshots

| Operation | Files | Options |
|-----------|-------|---------|
| find | `lib/stats/aggregation.ts` (×2) | `where: { and: [date=, objectType=] }`, `limit: 1` / `limit: 1000`, `sort: '-date'` |
| create | `lib/stats/aggregation.ts` | `data`, `depth: 0` |
| update | `lib/stats/aggregation.ts` | `id`, `data`, `depth: 0` |

### audit-entry

| Operation | Files | Options |
|-----------|-------|---------|
| create | `lib/bidding/sealed-opening.ts` (×3) | `data` |
| create | `lib/bidding/anti-snipe.ts` | `data` |

### leads

| Operation | Files | Options |
|-----------|-------|---------|
| create | `lib/leads/ingestion.ts` | `data` |

### company-access-request

| Operation | Files | Options |
|-----------|-------|---------|
| create | `app/api/v1/business/request-access/route.ts` | `data` (regCode, companyName, reason, requester fields, status) |
| create | `app/api/v1/auth/register/route.ts` | `data` (regCode, companyName, requesterName, requesterEmail, status) |

### pages (CMS, seed only)

| Operation | Files | Options |
|-----------|-------|---------|
| find | `payload/seed/cms.ts` | `limit: 1` |
| create | `payload/seed/cms.ts` (×7) | `data` |

### Reset (all collections)

| Operation | Files | Options |
|-----------|-------|---------|
| find | `payload/seed/reset.ts` | `limit: 100`, `pagination: false`, `depth: 0` |
| delete | `payload/seed/reset.ts` | `id` |

---

## 2. Where-operator set (actually used)

The repository layer must support these operators only:

| Operator | Example | Used in |
|----------|---------|---------|
| `equals` | `{ field: { equals: value } }` | Everywhere |
| `not_equals` | `{ status: { not_equals: 'rejected' } }` | sealed-bid.ts, sealed-opening.ts |
| `exists` (false only) | `{ revokedAt: { exists: false } }` | sealed-bid.ts, place-bid.ts |
| `in` | `{ template: { in: templateIds } }` | contract-gate.ts |
| `less_than_equal` | `{ endsAt: { less_than_equal: now } }` | auction-ending.ts |
| `and` | `{ and: [cond1, cond2] }` | Multiple files |
| `or` | `{ or: [cond1, cond2] }` | Auction access rules only |

**Not used anywhere in production code:** `greater_than`, `greater_than_equal`, `less_than` (standalone), `contains`, `like`, `near`, `within`.

---

## 3. Per-collection access-rule summaries

Access helpers are in `payload/access/`. `isAdmin` = role ∈ {admin, superadmin}. `adminOnly` = same. Role hierarchy: guest(0) < private(1) < company(2) < seller(3) < specialist(4) < admin(5) < superadmin(6).

### auctions
- **read:** anonymous → `{ status: 'active' }`. authenticated (non-specialist) → `{ status: 'active' }`. specialist → `or: [specialist = userId, status = active]`. admin/superadmin → full.
- **create:** admin, superadmin, specialist only.
- **update:** admin/superadmin full. specialist → `{ specialist: { equals: userId } }`. others → deny.
- **delete:** admin/superadmin only.
- **hooks:** `validateAuctionType` (beforeChange), `statusTransitionHook` (beforeChange).

### bids
- **create:** authenticated users only (any role with a session).
- **read:** admin → full. others → `{ user: { equals: userId } }`.
- **update:** admin only.
- **delete:** deny all.
- **hooks:** none.

### users
- **read:** admin/superadmin only.
- **create/update/delete:** not defined (Payload auth collection defaults).
- **hooks:** beforeChange encrypts isikukood, afterRead decrypts it.

### profile
- **read:** admin/superadmin → full. others → `{ user: { equals: userId } }`.
- **create:** anyone (including unauthenticated).
- **update:** admin/superadmin → full. others → `{ user: { equals: userId } }`.
- **delete:** admin/superadmin → full. others → `{ user: { equals: userId } }`.

### contracts
- **create:** admin/superadmin only.
- **read:** authenticated users.
- **update:** admin/superadmin only.
- **delete:** admin/superadmin only.

### contract-templates
- **create:** admin/superadmin only.
- **read:** public (no auth required).
- **update:** admin/superadmin only.
- **delete:** admin/superadmin only.
- **hooks:** beforeChange deactivates previous active template of same type.

### settings
- **read/create/update/delete:** no explicit access rules (Payload defaults apply).

### autobidders
- **create:** authenticated users.
- **read:** admin → full. others → `{ user: { equals: userId } }`.
- **update:** admin → full. others → `{ user: { equals: userId } }`.
- **delete:** admin → full. others → `{ user: { equals: userId } }`.
- **hooks:** beforeChange (create only) rejects duplicate active autobidder for same user+auction.

### auction-rights
- **read:** admin/superadmin → full. others → `{ user: { equals: userId } }`.
- **create:** admin/superadmin only.
- **update:** admin/superadmin only.
- **delete:** admin/superadmin only.

### auction-subscriptions
- **create:** authenticated users.
- **read:** admin → full. others → `{ user: { equals: userId } }`.
- **update:** admin → full. others → `{ user: { equals: userId } }`.
- **delete:** admin → full. others → `{ user: { equals: userId } }`.

### notifications
- **create:** deny all (server-side only via Payload Local API bypass).
- **read:** admin → full. others → `{ user: { equals: userId } }`.
- **update:** deny all.
- **delete:** deny all.

### leads
- **create/read/update/delete:** `adminOnly` (admin/superadmin only).

### audit-entry
- **create/read/update/delete:** `adminOnly`.

### statistics-snapshots
- **create:** admin/superadmin only.
- **read:** public.
- **update:** admin/superadmin only.
- **delete:** admin/superadmin only.

### media
- **read:** public.
- **create/update/delete:** not defined (Payload defaults).

### company-access-request
- **read/create/update/delete:** not defined (Payload defaults).

### Pages, Articles, FAQ, Testimonials, PartnerServices, LegalDocuments, Redirects (CMS)
- **No explicit access rules defined** — Payload defaults apply (likely admin-only for write, public for read via drafts config).

### Parishes, Counties, Specialist
- **No explicit access rules defined** — Payload defaults.

---

## 4. Proposed repository surface

```typescript
// --- Where operators (TypeScript types) ---

type WhereEquals = { equals: string | number | boolean }
type WhereNotEquals = { not_equals: string | number | boolean }
type WhereExists = { exists: boolean }
type WhereIn = { in: (string | number)[] }
type WhereLessThanEqual = { less_than_equal: string | number }

type WhereField =
  | WhereEquals
  | WhereNotEquals
  | WhereExists
  | WhereIn
  | WhereLessThanEqual

type WhereAnd = { and: WhereClause[] }
type WhereOr = { or: WhereClause[] }

type WhereClause = Record<string, WhereField> | WhereAnd | WhereOr

// --- Sort direction ---

type SortDirection = 'asc' | 'desc'
type SortField = `${string}` | `-${string}`  // leading '-' = desc

// --- Find options ---

interface FindOptions<T extends string = string> {
  collection: T
  where?: WhereClause
  limit?: number       // default 100
  depth?: number       // 0 = no populate, 1 = one level
  sort?: SortField
  pagination?: boolean // false = return all matching (seed/reset only)
}

interface FindByIDOptions<T extends string = string> {
  collection: T
  id: string | number
  depth?: number
}

interface CreateOptions<T extends string = string> {
  collection: T
  data: Record<string, unknown>
}

interface UpdateOptions<T extends string = string> {
  collection: T
  id: string | number
  data: Record<string, unknown>
  depth?: number
}

interface DeleteOptions<T extends string = string> {
  collection: T
  id: string | number
}

// --- Repository interface ---

interface Repository {
  find<T extends string>(options: FindOptions<T>): Promise<{ docs: Record<string, unknown>[] }>
  findByID<T extends string>(options: FindByIDOptions<T>): Promise<Record<string, unknown> | null>
  create<T extends string>(options: CreateOptions<T>): Promise<Record<string, unknown>>
  update<T extends string>(options: UpdateOptions<T>): Promise<Record<string, unknown>>
  delete<T extends string>(options: DeleteOptions<T>): Promise<void>
}

// --- Money conversion hooks ---
//
// All monetary fields (amount, minBid, maxAmount, bidStep, reservePrice,
// finalPrice, eur, volume) convert between integer cents at the repository
// boundary. The repository layer stores cents; callers pass/receive EUR as
// numbers. Conversion is automatic per the schema definition.
//
// TEXT-JSON parse points:
// - `payload/jsonb` fields (audit-entry.before, audit-entry.after,
//   notifications.payload) stored as TEXT, parsed by the repository on read.
// - `payload/richText` fields (specialist.bio) stored as TEXT, returned as-is
//   (no parse needed — the admin UI handles rendering).
// - identitySnapshot on bids is a JSON string (encrypted), not a JSON column.
```

---

## 5. Gap list

| Gap | Covered by decision record? | Notes |
|-----|-----------------------------|-------|
| **Drafts / versioning** | Yes — `0001` §1 | Four collections (Article, LegalDocument, Media, Page) configure `versions: { drafts: true }` but app code never reads `_status`. Decision: replace with a simple `status` select field. No draft UI in Phase 6. |
| **Payload hooks (beforeChange, afterRead)** | Partially — `0001` §1 mentions "lost niceties" | Users collection has isikukood encrypt/decrypt hooks. ContractTemplate has a deactivation hook. These must be reimplemented as repository-layer middleware or application-level guards. |
| **Auth collection (Payload auth: true)** | Yes — `0001` §1 (full replacement) | Users collection uses Payload auth (password hashing via `bcrypt`, session management). Replaced by custom auth in Phase 4. Register route passes raw password; Payload hashes it. |
| **Payload `depth` (relationship population)** | Not explicitly addressed | Calls use depth 0 or 1. The repository layer needs a `populate` or `include` mechanism for relationships. depth: 0 = no populate is the common case. |
| **`pagination: false` (return all)** | Not explicitly addressed | Used only in seed/reset. The repository can support `pagination: false` as an option. |
| **`SELECT … FOR UPDATE`** | Yes — `0001` §5 | Moves to Durable Objects (AuctionDO). The `withAuctionLock` function in place-bid.ts already wraps Drizzle directly. |
| **Direct Drizzle usage** | Partially — `0001` §5 | `place-bid.ts` and `alapakkumine.ts` use `payload.db.drizzle` for row-level locks and bid inserts inside transactions. These paths move to DO serialization. |
| **`where: { exists: false }`** | Not explicitly addressed | Used only on `auction-rights.revokedAt`. Must be supported as a where operator. |
| **`where: { in: [...] }`** | Not explicitly addressed | Used only on `contracts.template` (template IDs). Must be supported. |
| **`sort` with leading `-`** | Not explicitly addressed | Used on `statistics-snapshots` (`-date`) and `autobidders` (`createdAt`). Must be supported. |
| **Multi-collection `delete` (seed reset)** | Not relevant | Seed-only operation. The repository's `delete` method covers it. |
| **RichText fields** | Not addressed | `specialist.bio` is Payload `richText`. Stored as TEXT; the admin UI renders it. No parse needed in the repository. |
| **Upload fields** | Not addressed | `specialist.photo` is a Payload `upload` relation to `media`. The repository treats it as a foreign key. File storage moves to R2 (Phase 5). |
| **`jsonb` fields** | Yes — plan §5.2 | Stored as TEXT with JSON parse in repository layer. Fields: `audit-entry.before`, `audit-entry.after`, `notifications.payload`, `settings.featureFlags`, `auction.cadastres` (array of objects). |
