# realtime-sse Specification

## Purpose
TBD - created by archiving change phase-2-core-backend. Update Purpose after archive.
## Requirements
### Requirement: Public auction SSE stream
`GET /api/auctions/stream` SHALL be an SSE endpoint broadcasting live events:
`auction:published` (new lot), `auction:extended` (anti-snipe), `auction:ended`
(status flip), and `bid:created` (anonymised — amount + type only). The stream
SHALL work for anonymous (guest) requests.

#### Scenario: New bid appears on public stream
- **WHEN** a valid bid is placed on an active auction
- **THEN** all connected clients of `GET /api/auctions/stream` receive an
  SSE event `bid:created` with the auction ID, bid amount, and type

#### Scenario: Extension broadcast
- **WHEN** anti-sniping extends an auction endTime
- **THEN** all connected clients receive `auction:extended` with the new
  endTime

### Requirement: Authenticated user SSE stream
`GET /api/my/stream` SHALL deliver personal events to an authenticated user:
`bid` (leading/outbid), `outbid` notification, `auction_end`, `notification`
(new unread), and `countdown_sync` (clock skew correction). The stream SHALL
send a heartbeat every 30 seconds and SHALL disconnect after 3 missed
heartbeats. Reconnection SHALL use exponential backoff (1s → 2s → 4s →
max 30s), full re-fetching state on reconnect.

#### Scenario: Outbid user receives SSE alert
- **WHEN** another user outbids a previously leading bidder
- **THEN** the outbid user's `GET /api/my/stream` receives an `outbid`
  event with auction ID and new leading amount

#### Scenario: Heartbeat keeps connection alive
- **WHEN** 15 seconds pass with no domain events
- **THEN** the stream emits a `ping` heartbeat event

#### Scenario: Reconnect after disconnect
- **WHEN** the SSE connection drops and a client reconnects
- **THEN** the server resends the full current state for that user (leading
  bid status, unread notifications, countdowns) before streaming new events

### Requirement: SSE via Cloudflare Pages Functions
All SSE endpoints SHALL be served from Next.js route handlers compatible
with the `@cloudflare/next-on-pages` Functions runtime. Responses SHALL
use `content-type: text/event-stream` and keep the connection open until
the client disconnects or the server terminates it.

#### Scenario: SSE connection survives Cloudflare Pages cold start
- **WHEN** a new SSE connection is opened to a Pages Function
- **THEN** the connection is established successfully and the first
  heartbeat arrives within 30 seconds

