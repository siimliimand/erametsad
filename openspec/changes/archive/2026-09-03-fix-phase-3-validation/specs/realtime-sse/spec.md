# realtime-sse Delta

## MODIFIED Requirements

### Requirement: Public auction SSE stream
`GET /api/v1/auctions/stream` SHALL support the events
`auction:published`, `auction:extended`, `auction:ended`, and
`bid:created`, each fanned out from the `AuctionDO` hub at the moment
the corresponding domain action commits: publication/activation,
anti-snipe extension, alarm-driven ending, and accepted bid.
`bid:created` payloads SHALL carry `auctionId` and `placedAt` only and
SHALL NOT carry `amount`; guests MUST NOT be able to recover bid amounts
from public stream frames. Authenticated viewers obtain amounts through
authenticated endpoints or the authenticated user stream. A 30-second
comment heartbeat SHALL keep the connection alive.

#### Scenario: Bid event reaches subscribers without amounts
- **WHEN** a bid is accepted on a public auction
- **THEN** all stream subscribers receive `bid:created` with `auctionId`
  and `placedAt` and no amount field

#### Scenario: Guest cannot recover amounts from frames
- **WHEN** a guest subscribes to the public stream and reads raw frames
- **THEN** no bid amount appears in any `bid:created` payload

#### Scenario: Extension event reaches subscribers
- **WHEN** an anti-snipe extension extends an auction
- **THEN** subscribers receive `auction:extended` with the new end time
