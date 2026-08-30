export function MaskedAmount({ explanation }: { explanation: string }) {
  return (
    <span
      title={explanation}
      aria-label={explanation}
      className="cursor-help text-inkMuted"
    >
      —
    </span>
  )
}
