import type { SealedCeremonyChecklist } from '../../../../../_actions/auctions'

/** Signing is server-blocked unless all three hard preconditions pass. */
export function ceremonyChecklistPass(checklist: SealedCeremonyChecklist): boolean {
  return (
    checklist.endingWorker.done &&
    checklist.pendingAlapakkumised === 0 &&
    checklist.template.active
  )
}

function ChecklistItem({
  pass,
  label,
  detail,
  warning,
}: {
  pass: boolean
  label: string
  detail: string
  warning?: string | undefined
}) {
  return (
    <li className="flex items-start gap-sm">
      <span
        aria-hidden="true"
        className={`mt-0.5 font-semibold ${pass ? 'text-primary' : 'text-danger'}`}
      >
        {pass ? '✓' : '✗'}
      </span>
      <div>
        <p className="text-bodySm font-semibold text-ink">{label}</p>
        <p className={`text-bodySm ${pass ? 'text-ink-muted' : 'text-danger'}`}>{detail}</p>
        {warning ? (
          <p className="mt-1 text-bodySm text-statusEndingSoon">{warning}</p>
        ) : null}
      </div>
    </li>
  )
}

/** Precondition checklist: pass/fail per item, gating the signing UI. */
export function CeremonyChecklist({ checklist }: { checklist: SealedCeremonyChecklist }) {
  const { endingWorker, pendingAlapakkumised, template } = checklist
  return (
    <section className="rounded-card border border-border bg-bgPage p-md">
      <h2 className="mb-sm font-heading text-h4 font-bold text-ink">Eelkontroll</h2>
      <ul className="space-y-sm">
        <ChecklistItem
          pass={endingWorker.done}
          label="Lõppaeg on kinnitatud"
          detail={
            endingWorker.done
              ? `Lõpetustöötlus tehtud (idempotentsusvõti: ${endingWorker.key ?? '—'})`
              : 'Lõpetustöötlus puudub — lõppaega ei ole kinnitatud'
          }
        />
        <ChecklistItem
          pass={pendingAlapakkumised === 0}
          label="Ootel alapakkumised"
          detail={
            pendingAlapakkumised === 0
              ? 'Puuduvad'
              : `Ootel: ${String(pendingAlapakkumised)} — otsusta alapakkumised enne avamist`
          }
        />
        <ChecklistItem
          pass={template.active}
          label="Aktiivne lepingu mall"
          detail={
            template.active
              ? `${template.name ?? 'Mall'} (${template.version ?? '—'})`
              : 'Aktiivset lepingu malli ei ole'
          }
          warning={
            template.active && template.changedWithin24h
              ? 'Malli on muudetud 24 tunni jooksul oksjoni alguse ümber — kontrolli versiooni enne allkirja.'
              : undefined
          }
        />
      </ul>
    </section>
  )
}
