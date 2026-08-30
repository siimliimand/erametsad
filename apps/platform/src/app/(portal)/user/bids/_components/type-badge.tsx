export function TypeBadge({ type }: { type: 'open' | 'sealed' }) {
  if (type === 'open') {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-pill bg-infoLight px-2 py-0.5 text-[11px] font-semibold text-info">
        AVATUD
      </span>
    )
  }
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-pill bg-bgMist px-2 py-0.5 text-[11px] font-semibold text-inkMuted">
      SULETUD
    </span>
  )
}
