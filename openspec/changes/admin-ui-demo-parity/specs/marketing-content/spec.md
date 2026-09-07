## ADDED Requirements

### Requirement: Page block storage

The CMS SHALL store marketing page content as ordered blocks:
`page_blocks` rows (pageId, type, ordinal, configJson) validated against
a block type registry with zod configs for hero, text, cards, accordion,
form, ticker, stats, cta, testimonials, and faq. Ordinals SHALL stay
contiguous under reorder, insert, and delete.

#### Scenario: Invalid block config rejected

- **WHEN** a block is saved with a config that fails its registry schema
- **THEN** the write is rejected with field-level errors and nothing is
  stored

### Requirement: Block builder UI

The page editor SHALL provide a block builder: an ordered block list
with move up/down and delete, an add-block menu from the registry, and a
per-block settings drawer, alongside a live read-only preview pane with
desktop and mobile width toggles. Destructive block changes SHALL use
the shared confirm dialog.

#### Scenario: Preview follows order

- **WHEN** a block is moved, added, or deleted
- **THEN** the preview re-renders in the same order without a page
  reload

### Requirement: Page version snapshots

Publishing a page SHALL create a version snapshot of its blocks. A
versions drawer SHALL list snapshots with author and time, show a
two-column diff between the current and a chosen version, and offer
restore. Snapshots SHALL be retained per the CMS retention policy.

#### Scenario: Restore returns to a snapshot

- **WHEN** an operator restores an earlier version
- **THEN** the block list and preview match that snapshot and the
  restore is recorded

### Requirement: Marketing block rendering

The marketing pages route SHALL render stored blocks through a shared
`PageBlocks` renderer component that maps each registry type to its
presentation, so admin preview and public rendering stay visually
consistent. Pages without blocks SHALL keep rendering their existing
content path.

#### Scenario: Legacy pages still render

- **WHEN** a page has no stored blocks
- **THEN** the route falls back to the previous rendering without error
