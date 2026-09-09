## MODIFIED Requirements

### Requirement: Content management screens

The content screens SHALL additionally:

- render the page editor through the block builder (drag reorder, per-block
  settings drawer, desktop/mobile live preview) with the versions drawer as
  the Ajavedu tab; the JSON textarea remains behind a "Kuva JSON"
  disclosure;
- provide mustand/ajasta/avalda publish buttons on pages and articles;
- give articles a category select, the full SEO panel (60/160 counters, SERP
  and OG previews, robots toggles, canonical URL), and a specialist author
  select;
- give FAQ categories and items an active toggle and FAQ items a short
  answer with a "Loe edasi…" expander;
- give testimonials a publish toggle (and an optional rating);
- give redirects a hit counter with a Tabamusi column, save validation
  (leading slash, self-redirect, chain depth), a typed delete reason, and
  CSV bulk import;
- align per-block settings with the CMS spec: hero intro limit 300 and
  overlay strength, card icon select, accordion default-open flag, form type
  and paigutus selects, ticker objectType filter and auto-refresh, stats
  suffix and source selects, CTA style, testimonials block sourced from the
  collection.

#### Scenario: Builder persists blocks

- **WHEN** the editor reorders blocks and saves
- **THEN** the block order persists and a new page version snapshot is
  created

#### Scenario: Article SEO counters

- **WHEN** the SEO description exceeds 160 characters
- **THEN** the counter shows over-limit and save is warned

### Requirement: Media library on R2

The media library SHALL require alt text for image uploads and edits (the
publish gate), and SHALL store focal point coordinates with a picker shared
with the lot editor, plus a replace-file action keeping the media id.

#### Scenario: Alt gate

- **WHEN** an image is uploaded without alt text
- **THEN** the upload is rejected with the alt-text requirement

## ADDED Requirements

### Requirement: Shared rich text editor

A single toolbar-limited rich text editor component SHALL serve the auction
wizard copy blocks, article body, FAQ answers, legal documents, and text
blocks. Output SHALL be sanitized HTML with a paste allowlist and
`rel="noopener"` on links.

#### Scenario: Paste is sanitized

- **WHEN** rich HTML with scripts is pasted
- **THEN** only allowlisted markup survives in the stored content

### Requirement: Statistics screen quick wins

Statistika SHALL filter by object type (including kiiroksjon) and county in
addition to the period, and the monthly chart SHALL be a stacked outcome
chart (müüdud / müümata / tühistatud).

#### Scenario: Outcome chart

- **WHEN** the statistics page renders the monthly chart
- **THEN** each month stacks sold, unsold, and cancelled counts
