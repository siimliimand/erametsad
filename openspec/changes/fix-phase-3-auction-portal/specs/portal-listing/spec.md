## ADDED Requirements

### Requirement: Saved-search subscription entry
The listing filter panel SHALL offer a "Telli teavitus" action for the
current filter state. For authed users it SHALL open the subscription
modal prefilled with the active filters (channel and frequency
selectable) and save through `POST /api/v1/auction-subscriptions`. For
guests it SHALL ask for email with a required visible consent checkbox
and save the subscription against that email. Success SHALL confirm with
a toast; errors SHALL show inline.

#### Scenario: Authed subscription from filters
- **WHEN** an authed user applies a Lääne-Viru county filter and clicks
  "Telli teavitus"
- **THEN** the modal opens prefilled with that filter and saving creates
  the subscription

#### Scenario: Guest subscription requires consent
- **WHEN** a guest submits the subscription form with an empty consent
  checkbox
- **THEN** submit is blocked with an inline error on the checkbox
