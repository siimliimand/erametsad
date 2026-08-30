## MODIFIED Requirements

### Requirement: Teavitused
`/user/notifications` SHALL offer three tabs: inbox (cursor-paginated 25,
category chips, unread highlighting, click marks read and deep-links),
"Seaded" preference matrix (8 events × email/SMS, SMS restricted to
bid/auction-critical events and phone verification), and "Otsingute
tellimused" saved-search cards (filter chips, frequency selector, edit
filters in a modal, delete with confirm, delete-all with typed count).
The preference matrix SHALL persist per user: the profiles PATCH accepts
a `notificationPreferences` object, the dispatcher consults it before
sending on a channel, and a disabled channel produces no notification.
The eight events SHALL match the domain event set, including the
auction-published event. "Märgi loetuks" SHALL clear all visible unread.
Unsubscribe token links SHALL open the confirm flow without a session.

#### Scenario: Muted channel sends nothing
- **WHEN** the user disables email for the outbid event and another
  bidder passes them
- **THEN** no outbid email is queued for that user

#### Scenario: Matrix persists across reload
- **WHEN** the user toggles a channel and reloads the page
- **THEN** the matrix shows the saved state

#### Scenario: Inbox click deep-links
- **WHEN** the user clicks an unread outbid notification
- **THEN** it is marked read and the browser navigates to the auction

#### Scenario: Saved search deleted
- **WHEN** the user confirms deleting one saved search
- **THEN** only that subscription is removed
