# Proposal: contract-template-source-drafting

## Why

The template editor modal shipped in `admin-ui-demo-parity` (task 10.2) cannot
persist anything. The draft disappears when the modal closes, and the modal
text tells operators to upload finished source through the "Uus mall" form
instead. The render layer is already prepared for stored content:
`renderTemplate` (apps/platform/src/lib/contracts/render.ts) prefers
`template.htmlContent` and falls back to generated HTML only when it is
missing. But `contract_templates` has no source column and there is no write
action, so the editor is a dead end.

`HtmlPreviewDrawer` (used by the editor's "Testrender" and the contract
detail page) renders with correct aria roles but lacks the overlay behaviors
every other admin overlay shares: Escape close, focus trap and restore, body
scroll lock, and backdrop click close.

## What Changes

- Schema: `contract_templates` gains a nullable `source_content` TEXT column
  and a nullable `source_format` TEXT column with a CHECK constraint
  (`'html'` or `'txt'`). DOCX-only versions keep both columns NULL, so the
  existing upload flow is untouched.
- Render: `renderTemplate` consumes the stored source. HTML source passes
  through as `htmlContent`; TXT source is escaped and wrapped. The test-render
  action serves the head version's stored source.
- Save action: a new audited `saveTemplateDraftAction` (permission
  `contracts:write`) creates a NEW `contract_templates` row as an inactive
  draft version: name, type and placeholders copied from the head version, a
  bumped version string (auto-suggested, editable in the modal), the source
  content and format. Activation stays the existing explicit action, matching
  the immutable version-per-row model. Audit action: `template.draft_save`.
- Editor modal: loads the head version's source on open, shows an editable
  next-version field, "Salvesta" calls the save action with toast feedback and
  closes on success, the legend text is corrected (the draft IS persisted now).
- Drawer parity: `HtmlPreviewDrawer` gains Escape close, focus trap and
  restore, body scroll lock, backdrop click close, and `aria-labelledby`
  pointing at its heading, wired through the shared `useOverlay` hooks.
- Tests for the render formats, the save action, the modal save flow, and the
  drawer overlay behaviors; ARCHITECTURE.md and DESIGN.md notes.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `admin-commerce-ops`: contract templates persist editable HTML/TXT source
  per version; saving drafts a new version; stored source drives renders.
- `admin-ui`: the document preview drawer shares the admin overlay behavior
  contract (Escape, focus trap/restore, scroll lock, backdrop close).
