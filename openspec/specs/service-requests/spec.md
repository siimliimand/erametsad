# service-requests Specification

## Purpose
TBD - created by archiving change phase-4-service-requests. Update Purpose after archive.
## Requirements
### Requirement: Service request submission

`POST /api/v1/service-requests` SHALL accept JSON bodies for the kava and
istutamine types and a multipart/form-data body for hooldusraie. The endpoint
SHALL validate the per-type payload with the shared validators in
`packages/types` (Estonian phone and email, one or more cadastres matching
`NNNNN:NNN:NNNN` with tolerant separator parsing, county reference for
hooldusraie and istutamine, at least one service checkbox per type group,
provisions for hooldusraie and istutamine), require a consent timestamp,
reject honeypot submissions with a neutral success, and apply an IP rate
limit of 5 requests per minute. Validation failures SHALL return 422 with
per-field errors.

#### Scenario: Valid kava request

- **WHEN** a visitor submits a kava request with valid contact fields,
  cadastres, and consent
- **THEN** the API returns 201 with the routed partner count and a
  `service_requests` row exists with type kava

#### Scenario: Honeypot submission

- **WHEN** a submission fills the honeypot field
- **THEN** the API returns a neutral success and no row is created

#### Scenario: Missing service selection

- **WHEN** an istutamine submission selects none of the three service parts
- **THEN** the API returns 422 with an error on the service group

### Requirement: Duplicate throttle

The endpoint SHALL reject a submission with the same phone number and
cadastral unit as a request created less than 10 minutes earlier with a 409
and the message "Päring on juba saadetud".

#### Scenario: Repeat submission within 10 minutes

- **WHEN** the same phone and cadastre submit twice within 10 minutes
- **THEN** the second submission returns 409 and no new row is created

### Requirement: Attachment upload

The hooldusraie type SHALL accept exactly one attachment of type PDF, JPG,
or PNG up to 10 MB. The file SHALL be stored in R2 under the
`service-requests/` key prefix and referenced from the row's attachments
JSON. A server-side upload failure SHALL keep the form data intact for
retry and surface the error under the file field.

#### Scenario: Valid file upload

- **WHEN** a hooldusraie request arrives with a 2 MB PDF
- **THEN** the object is stored in R2 under `service-requests/` and the row
  references it in attachments

#### Scenario: Rejected file type

- **WHEN** the attachment is a DOCX file
- **THEN** the API returns 422 with an inline file error

### Requirement: Routing record

At submission the service SHALL select active partners whose service types
include the request type and whose counties include the request county (or
all counties for kava, which has no county field), persist the selected
partner ids in `routed_to[]` on the row, and return the count to the caller.
Zero matches SHALL still create the row so the UI can show the fallback
copy.

#### Scenario: Partners matched

- **WHEN** a hooldusraie request arrives for a county with two active
  hooldusraie partners
- **THEN** the row stores both partner ids in routed_to and the API returns
  routedCount 2

#### Scenario: No partners available

- **WHEN** a request arrives for a type with no active partners
- **THEN** the row is created with an empty routed_to and the API returns
  routedCount 0

### Requirement: Hub page

`/paringud` SHALL render a hero with the 7-day promise, three service cards
that link to the request pages, a three-step "how it works" block, and an
anonymized active-partner count per service read server-side from the
partners table with content caching. The page SHALL NOT embed a LeadForm
and SHALL emit ItemList and BreadcrumbList JSON-LD.

#### Scenario: Card with partners

- **WHEN** the hub renders with two active kava partners
- **THEN** the kava card shows the anonymized count 2

#### Scenario: No LeadForm on hub

- **WHEN** the hub renders
- **THEN** the page contains no lead form and the only actions are the
  three service card links

### Requirement: Request form pages

The request pages SHALL share one form kit across `/paringud/metsamajanduskava`,
`/paringud/hooldusraie`, and `/paringud/metsa-istutamine`: tabs as real links
with the active page marked, contact fields, per-type field groups, consent
checkbox with forwarding wording, honeypot field, submit lock while sending,
toast on success, and a success state that replaces the form and shows the
routed count or the zero-partner fallback copy. Each page SHALL keep a
localStorage draft for 24 hours that never stores the consent checkbox or
the file, clear the draft on success, emit Service and BreadcrumbList
JSON-LD, and fire the spec'd analytics events through the consent-gated
`track()` helper.

#### Scenario: Draft restored

- **WHEN** a visitor returns to a form within 24 hours after filling it
- **THEN** the fields restore from the draft while the consent checkbox
  stays unchecked

#### Scenario: Success replaces the form

- **WHEN** a submission succeeds with routedCount 2
- **THEN** the form is replaced by the success state naming the routed
  count and the draft is cleared

#### Scenario: Network failure keeps the form

- **WHEN** the submission fails with a network error
- **THEN** the form data stays in place, the error shows inline, and the
  submit button re-enables

### Requirement: Disabled service state

A service with no active partners or a deactivated service SHALL keep its
hub card visible in the ended grey state with the text "Hetkel pole
saadaval". Its form page SHALL remain reachable and submittable with the
longer-response notice.

#### Scenario: Deactivated service card

- **WHEN** the istutamine service has no active partners
- **THEN** the hub renders the istutamine card grey with "Hetkel pole
  saadaval"

