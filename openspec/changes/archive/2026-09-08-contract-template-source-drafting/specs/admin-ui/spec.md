## ADDED Requirements

### Requirement: Document preview drawer shares the overlay contract

`HtmlPreviewDrawer` SHALL behave like every other admin overlay: it SHALL
close on Escape and backdrop click, trap focus while open, restore focus to
its trigger on close, and lock body scroll while open. Its dialog SHALL be
labelled by its heading element.

#### Scenario: Escape and backdrop close the preview

- **WHEN** the preview drawer is open and the operator presses Escape or
  clicks the backdrop
- **THEN** the drawer closes

#### Scenario: Focus is trapped and restored

- **WHEN** the preview drawer opens
- **THEN** focus moves into the drawer, Tab cycles inside it, and focus
  returns to the trigger button on close

#### Scenario: Body scroll is locked

- **WHEN** the preview drawer is open
- **THEN** the page behind it does not scroll
