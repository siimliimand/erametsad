// Honest placeholder: the real GDPR tools (export ZIP, anonymize with
// retention) are wired in by task 8.5.
export function GdprTab() {
  return (
    <div className="rounded-card border border-border bg-bgPage p-md">
      <h2 className="font-heading text-h4 font-bold text-ink">Isikuandmete haldus</h2>
      <p className="mt-xs text-bodySm text-ink-muted">
        GDPR-i tööriistad on veel arendamisel. Andmete eksport ja konto anonüümimine lisatakse
        siia eraldi arendusena.
      </p>
    </div>
  )
}
