# portal-api Delta

## MODIFIED Requirements

### Requirement: Notification read endpoints
`GET /api/v1/my/notifications` SHALL return the caller's notifications with
cursor pagination (25/page) and category/unread filters.
`PATCH /api/v1/my/notifications/:id/read` and
`PATCH /api/v1/my/notifications/read-all` SHALL mark items read. All
notification routes SHALL resolve the caller's session, not only the JWT
signature, and SHALL reject with 401 when the session is revoked.

#### Scenario: Mark all read
- **WHEN** `read-all` is called with 3 unread notifications
- **THEN** all 3 have `readAt` set and the bell badge clears

#### Scenario: Revoked session rejected
- **WHEN** a request carries an unexpired access token whose session has
  been revoked
- **THEN** the route responds 401

### Requirement: Seller auction endpoints
`GET /api/v1/my-auctions` SHALL return auctions owned by the seller with
view counts, bid counts, leading price for open auctions, and status.
`POST /api/v1/my-auctions/:id/relist-request` and
`.../request-review` SHALL create the corresponding requests and
notifications. Underbid approve/reject SHALL verify the caller's session
(revoked session → 401) and SHALL return HTTP 409 with the conflict reason
when a higher regular bid has arrived since submission; the coded reason
`higher_bid_exists` SHALL be included in that response.

#### Scenario: Stale alapakkumine approval rejected
- **WHEN** the seller approves an alapakkumine after a higher bid arrived
- **THEN** the API responds 409 with code `higher_bid_exists`, a reason
  the UI can display

#### Scenario: Revoked seller token rejected
- **WHEN** an underbid approval carries an unexpired token from a revoked
  session
- **THEN** the route responds 401
