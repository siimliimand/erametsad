## Context

Phase 0 is complete. The monorepo has a working Next.js 15 app (`apps/platform`)
with Payload CMS 3, shared packages (`ui`, `types`, `config`, `emails`), a
docker-compose dev environment, and a Cloudflare deployment path. The `packages/ui`
package exists but contains only `export {}`. The design system is fully specified
in `docs/design/README.md` (tokens, type scale, motion, component library) and
`docs/design/00-global-shell.md` (header, footer, contact band, cookie banner,
error pages). `DESIGN.md` at the repo root holds the token YAML.

No UI components exist yet. Every page in Phases 2–5 depends on this library.

## Goals / Non-Goals

**Goals:**

- Build the complete `packages/ui` component library with all components
  referenced by the design specs.
- Define CSS variable tokens and Tailwind theme extensions so every page uses
  the same colour, spacing, typography, and motion values.
- Self-host fonts with `latin-ext` subset for Estonian diacritics.
- Implement base accessibility: `prefers-reduced-motion`, focus-visible,
  skip-link.
- Add Estonian validators to `packages/types` (phone, isikukood, registrikood,
  cadastral).
- Provide a styleguide dev route that renders every component in every state.

**Non-Goals:**

- No page-level layouts or route groups (Phase 3–5 work).
- No API integration: components accept props, not fetch calls.
- No Payload CMS collections for content (Phase 2).
- No real eID, email, or map tile integration beyond Leaflet + Maa-amet WMS
  (free, no key).
- No `SubsidyCard` (Phase 5, tagged [L]).

## Decisions

1. **CSS variables as the token layer.** All design tokens (colours, spacing,
   radii, shadows, motion) are CSS custom properties in
   `packages/ui/src/styles/tokens.css`. Tailwind extends its theme from these
   variables so utility classes and component styles share one source of truth.

2. **Tailwind theme mapping in `apps/platform`.** The Tailwind config in
   `apps/platform` imports token values and maps them to theme extensions.
   Components in `packages/ui` use Tailwind classes that resolve against this
   theme. This keeps `packages/ui` framework-agnostic at the CSS level.

3. **Self-hosted fonts via `next/font`.** Manrope, Inter, and JetBrains Mono
   are self-hosted through `next/font` with `latin-ext` subset. Font CSS
   variables are set on the root layout. `packages/ui` references these
   variables, not font-family literals.

4. **Component file structure.** One file per component in `packages/ui/src/components/`.
   Form components go in a `form/` subdirectory. Content components go in a
   `content/` subdirectory. A barrel `index.ts` re-exports everything.

5. **Leaflet for maps.** `MapEstonia` uses Leaflet with Maa-amet WMS orthophoto
   tiles (free, no API key) and Estonian county GeoJSON. OSM tiles are the
   fallback. A static-image fallback covers CDN failure.

6. **No animation library.** Motion uses CSS transitions and keyframes only.
   `prefers-reduced-motion` disables all animations. No Framer Motion or
   similar dependency.

7. **Estonian validators in `packages/types`.** Phone (`+372…`), isikukood
   (11-digit checksum), registrikood (8 digits), and cadastral (`NNNNN:NNN:NNNN`)
   validators use Zod schemas. They are imported by form components and by
   Phase 2 API validation.

## Risks / Trade-offs

- **Leaflet bundle size.** Leaflet adds ~40 KB gzipped. Mitigation: dynamic
  import (`next/dynamic`) so the map loads only on pages that need it.
- **Font file weight.** Three font families with multiple weights and
  `latin-ext` subset add ~200 KB total. Mitigation: `next/font` handles
  subsetting and `font-display: swap`.
- **Component count.** 22+ components in one phase is a lot of surface area.
  Mitigation: most components are small (under 100 lines). The styleguide
  route provides visual verification.
- **Tailwind purging.** Components in `packages/ui` must use Tailwind classes
  that the app's Tailwind config can resolve. Mitigation: the app's
  `content` array includes `packages/ui/src/**`.

## Migration Plan

Greenfield within the existing scaffold. The `packages/ui` package goes from
`export {}` to a full component library. No breaking changes to existing code.
The `packages/types` package adds new exports without modifying existing ones.

## Open Questions

- Should `packages/ui` ship its own Tailwind preset, or should the app-level
  Tailwind config be the single source? (Current decision: app-level config.)
- Do form components need their own `FormProvider` context, or is prop
  drilling sufficient for the prototype? (Current decision: prop drilling;
  add context if prop chains exceed three levels.)
