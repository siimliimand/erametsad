## MODIFIED Requirements

### Requirement: AdminShell chrome

The shell SHALL keep the 13-module icon rail, and in addition:

- the ⌘K command palette SHALL list jump targets for all 13 modules;
- the environment badge SHALL distinguish PROD, STAGE, and dev/test;
- the CMS nav label SHALL read "Sisuhaldus".

#### Scenario: Palette covers every module

- **WHEN** the operator opens the ⌘K palette
- **THEN** a jump target exists for each of the 13 nav modules

#### Scenario: Stage badge

- **WHEN** the app runs in a staging deployment
- **THEN** the topbar shows a STAGE badge, and PROD shows no badge

## ADDED Requirements

### Requirement: Impersonation banner shows session expiry

The impersonation banner SHALL display the remaining session time as a
countdown while an admin views the system as a user.

#### Scenario: Countdown visible

- **WHEN** an impersonation session is active
- **THEN** the banner shows whose view it is and the remaining minutes

### Requirement: Dashboard parity

Töölaud SHALL follow the documented semantics: the "Lõpevad täna" window is
the Europe/Tallinn calendar day, the ending-today KPI is amber when the count
is greater than 0, bids-today shows a 7-day sparkline, pending confirmations
are red only when greater than 0, new-lead counting is today AND (unassigned
OR status uus), the fee KPI excludes VAT, the recent-leads block shows the 8
newest leads with county and specialist chips linking to Juhtlõimed, and
Süsteemi tervis is visible to admins and superadmins only.

#### Scenario: Calendar-day window

- **WHEN** an auction ends tomorrow at 00:30 Europe/Tallinn
- **THEN** it is not counted in "Lõpevad täna" today

#### Scenario: Amber KPI

- **WHEN** at least one auction ends today
- **THEN** the KPI card renders amber

#### Scenario: Lead count filter

- **WHEN** an unassigned lead from today sits in status Võetud ühendust
- **THEN** the "Uued juhtlõimed" KPI counts it
