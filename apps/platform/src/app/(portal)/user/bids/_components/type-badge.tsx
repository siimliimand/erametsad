// Demo .type-badge (09-user-bids.html): "Avatud" outlined in the green
// status color, "Suletud" solid grey. Uppercase styling mirrors the demo.
export function TypeBadge({ type }: { type: 'open' | 'sealed' }) {
  if (type === 'open') {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-pill border border-statusActive bg-bgPage px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.04em] text-statusActive">
        Avatud
      </span>
    )
  }
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-pill border border-inkMuted bg-inkMuted px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.04em] text-inkInverse">
      Suletud
    </span>
  )
}
