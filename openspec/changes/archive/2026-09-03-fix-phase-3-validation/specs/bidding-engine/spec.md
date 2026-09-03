# bidding-engine Delta

## MODIFIED Requirements

### Requirement: Alapakkumine (under-start bid)
When Settings enable alapakkumine, bid admission SHALL accept a bid below
`minBid` by creating it with status `pending_approval` instead of
rejecting it. When disabled, a below-minimum bid SHALL be rejected. Seller
approval SHALL move the bid to `leading` and demote any current leader to
`outbid`, unless the auction's current leading bid is a regular bid whose
amount exceeds the under-start amount; in that case approval SHALL be
rejected with the coded conflict `higher_bid_exists` and HTTP 409, the
pending bid stays `pending_approval`, and no leader is demoted. Rejection
of the under-start bid by the seller SHALL set `rejected` and notify the
bidder. Approval SHALL be race-guarded, and both decisions SHALL be
exposed as authed seller endpoints under
`/api/v1/my-auctions/:id/underbids/:bidId/approve|reject`.

#### Scenario: Under-start bid awaits approval
- **WHEN** alapakkumine is enabled and a user bids below `minBid`
- **THEN** the bid is stored as `pending_approval` and the seller is
  notified

#### Scenario: Approval takes the lead
- **WHEN** the seller approves a pending bid and no higher regular bid
  leads the auction
- **THEN** the bid becomes `leading` and any previous leader becomes
  `outbid`

#### Scenario: Approval rejected when a higher regular bid leads
- **WHEN** the seller approves a pending bid whose amount is below the
  current leading regular bid
- **THEN** the API responds 409 with code `higher_bid_exists`, the
  pending bid stays `pending_approval`, and the leader is unchanged

#### Scenario: Concurrent approvals are serialised
- **WHEN** two approval requests race
- **THEN** the second is a no-op or conflict response
