## ADDED Requirements

### Requirement: Contract template manager parity

The contracts module SHALL render templates as a card grid with version
chips, expandable version history, and active/draft pills, and SHALL
provide an editor modal where HTML/TXT template placeholders insert at
the cursor from a clickable chip list, with test render reusing the
existing preview drawer. The existing upload validation, activation, and
DOCX support SHALL not regress.

#### Scenario: Placeholder insert

- **WHEN** the operator clicks a placeholder chip in the editor
- **THEN** the token is inserted at the cursor position of the template
  source

### Requirement: Service request routing parity

The inquiries module SHALL show the 7-day response rule as an info
strip, tint expired requests in the list, and track per-partner responses
(with price and status) in the routing drawer. Existing capacity,
county-coverage, minimal-payload, and forward-log behavior SHALL be
preserved.

#### Scenario: Expired request is visible

- **WHEN** a forwarded request passes the 7-day window without response
- **THEN** its row is tinted and its age is rendered in the danger style
