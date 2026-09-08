## ADDED Requirements

### Requirement: Auction wizard chrome and draft autosave

The auction wizard SHALL render the demo editor bar (auction id in mono,
status pill, autosave indicator with a ping on each save, portal preview
link) and a step rail with per-step status marks: done, current, todo,
and disabled (hidden Pakett step), plus a defect count footer. The wizard
SHALL autosave the in-progress draft to localStorage, offer restore on
return, and warn on unload when dirty. Durable saving stays on submit.

#### Scenario: Operator leaves and returns

- **WHEN** an operator with an unsaved wizard draft reopens the form
- **THEN** a restore prompt offers the local draft and submission still
  remains the authoritative save

### Requirement: Auctions list parity

The auctions list SHALL provide a column chooser with persisted
visibility, a mint selected-row tint, tab-count inversion on the active
tab, and a global keyboard shortcut to start a new auction. Existing
filters, bulk bar, row actions, countdowns, and the manual-end modal
SHALL keep their behavior.

#### Scenario: Hidden column stays hidden

- **WHEN** the operator hides a column and reloads the list
- **THEN** the column stays hidden from the persisted choice

### Requirement: Bid monitor parity

The bid monitor SHALL present the demo monitor-head strip (large ticking
timer, anti-snipe chip, leading bid with step), collapse rapid autobid
bursts into an expandable duel row, and offer audited bidder identity
reveals inline in the feed. An anomaly panel SHALL compute new-account
burst and rapid-overtake heuristics and let staff flag internal review
with an audit entry.

#### Scenario: Autobidder duel collapses

- **WHEN** two autobidders exchange several bids within seconds
- **THEN** the burst renders as one collapsed row that expands on demand

#### Scenario: Reveal is audited

- **WHEN** an admin reveals a bidder identity from the live feed
- **THEN** a `user.identity_view` audit entry records the reveal

### Requirement: Ceremony presentation

The sealed-bid ceremony SHALL render the persistent amber audit banner,
a blurred reveal table with a veil before the simultaneous reveal, a
staggered row reveal after it (disabled under reduced motion), toasts on
ceremony actions, and a live audit strip of sealed-event entries for the
auction. The existing two-person signing, reveal lock, and winner
decision behavior SHALL not change.

#### Scenario: Reveal reads as an event

- **WHEN** the operator triggers the reveal
- **THEN** the veil lifts, rows fade in staggered, and the audit strip
  appends the decryption entry
