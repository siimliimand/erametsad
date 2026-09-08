# Tasks: contract-template-source-drafting

## 1. Persistence and render

- [ ] 1.1 Add nullable `source_content` TEXT and nullable `source_format` TEXT with a CHECK constraint (`'html'`, `'txt'`) to `contract_templates`; generate the drizzle migration; schema lint green <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/data/schema/contract-templates.ts, apps/platform/drizzle/**] -->
- [ ] 1.2 Honor stored source in `renderTemplate` (html passthrough; txt escaped and wrapped) and serve the head version's stored source from `testRenderTemplateAction` <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/lib/contracts/render.ts, apps/platform/src/app/(admin)/_actions/contracts.ts] -->
- [ ] 1.3 Add `saveTemplateDraftAction` (contracts:write gate, copies name/type/placeholders from head, stores source + format, active=false, validated auto-suggested next version, `template.draft_save` audit, revalidate + notice) and expose head `sourceContent` + suggested `nextVersion` to the templates page <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(admin)/_actions/contracts.ts, apps/platform/src/app/(admin)/admin/contracts/templates/page.tsx] -->

## 2. UI wiring

- [ ] 2.1 Editor modal save UX: load the head version's source on open, editable next-version field, "Salvesta" calls the save action with toast feedback and closes on success, legend text corrected <!-- agent: fullstack-engineer.build, depends_on: [1.3], touches: [apps/platform/src/app/(admin)/admin/contracts/_components/TemplateEditorModal.tsx, apps/platform/src/app/(admin)/admin/contracts/templates/_components/TemplateCard.tsx] -->
- [ ] 2.2 `HtmlPreviewDrawer` overlay parity: Escape close, focus trap + restore, body scroll lock, backdrop click close, `aria-labelledby` on the heading, via the shared `useOverlay` hooks <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(admin)/admin/contracts/_components/HtmlPreviewDrawer.tsx] -->

## 3. Tests

- [ ] 3.1 Tests: render formats (html passthrough, txt escaping), save action (permission denial, version bump, inactive row, audit entry, version validation), modal save flow including head-content reload and chip insertion across reopen <!-- agent: fullstack-engineer.build, depends_on: [1.2, 2.1], touches: [apps/platform/src/app/(admin)/admin/contracts/_components/__tests__/**, apps/platform/src/app/(admin)/_actions/__tests__/**, apps/platform/src/lib/contracts/**/__tests__/**] -->
- [ ] 3.2 Tests: drawer overlay behaviors (Escape, backdrop, focus trap and restore, scroll lock, aria labelling) <!-- agent: fullstack-engineer.build, depends_on: [2.2], touches: [apps/platform/src/app/(admin)/admin/contracts/_components/__tests__/HtmlPreviewDrawer.test.tsx] -->

## 4. Docs and verification

- [ ] 4.1 Update ARCHITECTURE.md (contracts module: stored source + draft save flow) and DESIGN.md if the editor section needs the save affordance <!-- agent: fullstack-engineer.fast, depends_on: [3.1, 3.2], touches: [ARCHITECTURE.md, DESIGN.md] -->
- [ ] 4.2 Run pnpm lint, pnpm typecheck, pnpm test, pnpm build; fix fallout; report results <!-- agent: fullstack-engineer.fast, depends_on: [4.1], touches: [] -->
