## ADDED Requirements

### Requirement: Template source persistence

The system SHALL store editable template source per contract template
version in two nullable columns on `contract_templates`: `source_content`
(TEXT) and `source_format` (TEXT, CHECK-constrained to `'html'` and
`'txt'`). Versions created by the DOCX upload flow SHALL keep both columns
NULL and continue to render through the existing path.

#### Scenario: DOCX-only versions are unaffected

- **WHEN** a contract template version has no stored source
- **THEN** the render falls back to the existing generated HTML path and
  the version row remains valid

### Requirement: Save as new draft version

The admin SHALL save editor source as a NEW inactive `contract_templates`
row (a new version), never by mutating an existing version row. The save
SHALL require the `contracts:write` permission, copy `name`, `type` and
`placeholders` from the head version, store the source content and format,
set `active` to false, suggest the next version string (validated, editable
by the operator), write a `template.draft_save` audit entry, and revalidate
the templates view. Activation of the draft remains the existing explicit
action.

#### Scenario: Operator saves a draft

- **WHEN** an operator with `contracts:write` saves editor source for a
  template
- **THEN** a new inactive version row exists with a bumped version string,
  the stored source, and a `template.draft_save` audit entry, and the
  previously active version is unchanged

#### Scenario: Save is permission-gated

- **WHEN** a session without `contracts:write` calls the save action
- **THEN** the action rejects with the standard Estonian permission error
  and writes nothing

#### Scenario: Version string is validated

- **WHEN** the save action receives a version string that is empty or
  already used by the same template name
- **THEN** the action rejects with a per-field Estonian error and writes
  nothing

### Requirement: Stored source drives renders

`renderTemplate` SHALL use the stored source when present: `html` format
passes through as the HTML content; `txt` format is escaped and wrapped.
The test-render action SHALL render the head version's stored source with
the fixture data set.

#### Scenario: TXT source renders escaped

- **WHEN** a template version stores `txt`-format source
- **THEN** the rendered HTML escapes the source and no raw markup from the
  source reaches the output

#### Scenario: Test render shows the stored source

- **WHEN** the operator opens "Testrender" for a version with stored
  source
- **THEN** the preview renders that source with fixture data instead of
  the generated fallback
