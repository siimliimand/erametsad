## ADDED Requirements

### Requirement: Complete module routing

Every module id in `ADMIN_MODULES` SHALL resolve to a real page: the
companies module at `/admin/companies`, inquiries at `/admin/inquiries`,
statistics at `/admin/statistics`, settings at `/admin/settings`, a
sealed-opening index at `/admin/sealed-opening`, and a notifications
list at `/admin/notifications`. Relocated screens (companies, inquiries,
settings) SHALL redirect from their previous paths. No admin module href
MAY return 404 for a role that can see the module.

#### Scenario: Old paths redirect

- **WHEN** a bookmarked `/admin/leads/requests`, `/admin/requests`, or
  `/admin/content/settings` URL is opened
- **THEN** the request redirects to the new module path with the same
  role gating

### Requirement: Sealed-opening index

The sealed-opening module SHALL list sealed auctions whose end time has
passed and whose ceremony is not completed, with the registered bid
count and a link into the per-auction ceremony. The count SHALL feed the
module's rail badge.

#### Scenario: Admin finds the next ceremony

- **WHEN** a sealed auction ends
- **THEN** it appears in the sealed-opening list and the rail badge
  count increases
