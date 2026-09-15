## MODIFIED Requirements

### Requirement: Minu müügid

`/user/objects` SHALL render the demo page head with the right-aligned CTA
"Paku oma objekti" and the filter chips Kõik, Käimasolevad, Lõppenud,
Mustandid (Käimasolevad covers scheduled and active auctions). The CTA SHALL
navigate to the in-portal submission wizard `/user/objects/paku` on the portal
host, not to the marketing site. Lots SHALL render as demo object cards: the
title with the type badge, the sub line, the stat rows "Hetke hind" or
"Lõpphind", "Pakkumisi", "Vaatamisi" with the "+N / 24h" chip, and "Jälgijaid";
the right rail with the status pill ("Aktiivne", "Leping allkirjastatud",
"Müümata", "Mustand"), the live countdown for active lots, and the actions
("Vaata oksjonit", "Leping ja PDF", "Proovi uuesti" for unsold, "Muuda" for
drafts). Unsold and draft cards SHALL render dimmed with their demo notes. A
draft SHALL keep the preview and the "Saada spetsialistile" review request; an
unsold lot SHALL keep the relist request. A persistent banner SHALL surface
pending alapakkumised. The lot drawer SHALL carry the bid log (anonymized,
newest first, autobid markers) and the alapakkumine queue with approve/reject
confirms; approval SHALL become leading and reject SHALL notify the bidder; a
409 race SHALL render the conflict message with follow-up options. Drafts
created through the portal wizard SHALL appear under Mustandid for the
submitter immediately after submission.

#### Scenario: CTA stays in the portal

- **WHEN** a logged-in user clicks "Paku oma objekti"
- **THEN** navigation goes to `/user/objects/paku` and the marketing host is
  not loaded

#### Scenario: Submitted draft shows up

- **WHEN** the wizard completes a sale submission
- **THEN** the new draft is listed under Mustandid for the submitter with the
  standard draft card actions

## ADDED Requirements

### Requirement: Minu päringud

`/user/objects` SHALL render a Teenused section listing the signed-in user's
own service requests, sourced from the `user_id` column. Each row SHALL show
the service type label (Metsamajanduskava, Hooldusraie, Metsa istutamine), a
status pill (Uus, Suunatud, Teostatud, Suletud), and the created date. The
section SHALL show an empty state when the user has no requests. Requests
created anonymously on the marketing site SHALL NOT appear, and the section
SHALL NOT expose partner routing details.

#### Scenario: Own requests listed

- **WHEN** a user with two wizard-submitted service requests opens
  `/user/objects`
- **THEN** the Teenused section lists both rows with their type labels and
  current status pills

#### Scenario: Empty state

- **WHEN** a user has never submitted a service request
- **THEN** the Teenused section renders its empty state with a pointer to the
  wizard
