## MODIFIED Requirements

### Requirement: Public auction SSE stream
`GET /api/v1/auctions/stream` SHALL support the events
`auction:published`, `auction:extended`, `auction:ended`, and
`bid:created`, each emitted at the moment the corresponding domain action
commits: publication/activation, anti-snipe extension, worker ending, and
accepted bid. `bid:created` payloads SHALL be anonymised (amount and
relative time only, never bidder identity). A 30-second comment heartbeat
SHALL keep the connection alive.

#### Scenario: Bid event reaches subscribers
- **WHEN** a bid is accepted on a public auction
- **THEN** all stream subscribers receive `bid:created` with the amount
  and no bidder identity

#### Scenario: Extension event reaches subscribers
- **WHEN** an anti-snipe extension extends an auction
- **THEN** subscribers receive `auction:extended` with the new end time

### Requirement: Authenticated user SSE stream
`GET /api/v1/my/stream` SHALL deliver the per-user events `bid`,
`outbid`, `auction_end`, `notification`, and `countdown_sync` to the
authenticated user's connections. The displaced bidder SHALL receive
`outbid` when their bid is overtaken. Notification creation SHALL push
the `notification` event. A 30-second heartbeat SHALL keep the connection
alive.

#### Scenario: Outbid notification arrives live
- **WHEN** a user's leading bid is overtaken
- **THEN** their open `my/stream` connection receives `outbid`

#### Scenario: Notification push
- **WHEN** a notification row is created for the user
- **THEN** their stream receives the `notification` event
