'use client'

import type { WizardStepContext } from './wizard-model'
import { reviewIssues, wizardFieldDiff, wizardSummaryRows } from './wizard-model'
import { FieldHint, FieldLabel, WarningNote } from './wizard-ui'
import { primaryButtonClass, inputClass } from '../../../_components/FormField'

/**
 * Step 7 Ülevaade ja avaldamine (docs/design/admin/03 step 7): the
 * cross-step validation summary where every failure links to its step, the
 * read-only field summary, the two-column diff against the saved copy when
 * editing a published (mechanics-locked) lot, and the guest draft-preview
 * link. Warnings never block; errors stop the wizard submit and the publish.
 */

export function StepUlevaade({
  state,
  initial,
  options,
  goToStep,
}: WizardStepContext) {
  const issues = reviewIssues(initial, state, options)
  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  const canPublish =
    initial.auctionId !== null && options.publishAuction !== undefined && errors.length === 0

  const summaryRows = wizardSummaryRows(initial, state, options)
  const diffRows = initial.mechanicsLocked ? wizardFieldDiff(initial, state, options) : []

  const stepList: { step: number; label: string }[] = [
    { step: 1, label: 'Tüüp ja mehaanika' },
    { step: 2, label: 'Asukoht' },
    { step: 3, label: 'Maa ja mets' },
    { step: 4, label: 'Hind' },
    { step: 5, label: 'Sisu' },
  ]
  if (state.objectType === 'pakett') stepList.push({ step: 6, label: 'Pakett' })
  stepList.push({ step: 7, label: 'Ülevaade' })

  return (
    <div className="flex flex-col gap-sm">
      <section className="flex flex-col gap-xs">
        <h3 className="text-label font-semibold text-ink">Sammud</h3>
        <ol className="flex flex-col gap-1">
          {stepList.map((entry) => (
            <li key={String(entry.step)} className="flex items-center justify-between gap-xs">
              <span className="text-bodySm text-ink">
                {String(entry.step)}. {entry.label}
              </span>
              <button
                type="button"
                onClick={() => {
                  goToStep(entry.step)
                }}
                className="text-bodySm font-semibold text-primary underline-offset-2 hover:underline"
              >
                Muuda
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-xs rounded-card border border-border p-sm">
        <h3 className="text-label font-semibold text-ink">Väljade kokkuvõte</h3>
        <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[minmax(9rem,auto)_1fr]">
          {summaryRows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-bodySm text-inkMuted">{row.label}</dt>
              <dd className="m-0 whitespace-pre-wrap text-bodySm font-medium text-ink">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        <FieldHint>Kokkuvõte on kirjutuskaitses; muudatused tehakse vastaval sammul.</FieldHint>
      </section>

      {diffRows.length > 0 ? (
        <section className="flex flex-col gap-xs rounded-card border border-border p-sm">
          <h3 className="text-label font-semibold text-ink">
            Muudatused võrreldes salvestatud olekuga
          </h3>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border text-label text-inkMuted">
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Väli
                </th>
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Salvestatud
                </th>
                <th scope="col" className="py-1.5 font-medium">
                  Praegune
                </th>
              </tr>
            </thead>
            <tbody>
              {diffRows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-b-0">
                  <td className="py-1.5 pr-3 align-top text-bodySm text-inkMuted">{row.label}</td>
                  <td className="py-1.5 pr-3 align-top text-bodySm text-ink">
                    {row.masked ? (
                      <span className="italic text-inkMuted">{row.saved}</span>
                    ) : (
                      row.saved
                    )}
                  </td>
                  <td className="py-1.5 align-top text-bodySm font-medium text-ink">
                    {row.masked ? (
                      <span className="italic text-inkMuted">{row.current}</span>
                    ) : (
                      row.current
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <FieldHint>
            Avaldamiseks salvesta muudatused; server kontrollib lubatud välju uuesti.
          </FieldHint>
        </section>
      ) : null}

      <section className="flex flex-col gap-xs">
        <h3 className="text-label font-semibold text-ink">Kontroll ja avaldamise eeltingimused</h3>
        {issues.length === 0 ? (
          <p className="text-bodySm font-medium text-ink">
            Kõik avaldamise eeltingimused on täidetud.
          </p>
        ) : (
          <ul className="flex flex-col gap-xs">
            {issues.map((issue, index) => (
              <li key={`${issue.field}-${String(index)}`} className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-xs">
                  <span
                    className={`rounded-pill px-2 text-bodySm font-semibold ${
                      issue.severity === 'error'
                        ? 'bg-dangerLight text-danger'
                        : 'bg-infoLight text-info'
                    }`}
                  >
                    {issue.severity === 'error' ? 'Viga' : 'Hoiatus'}
                  </span>
                  <span className="min-w-0 flex-1 text-bodySm text-ink">{issue.message}</span>
                  <button
                    type="button"
                    onClick={() => {
                      goToStep(issue.step)
                    }}
                    className="whitespace-nowrap text-bodySm font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    Mine parandama →
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <FieldHint>
          Hoiatused ei takista salvestamist ega avaldamist; vead peavad enne avaldamist kaduma.
        </FieldHint>
      </section>

      {initial.guestPreviewHref !== null ? (
        <a
          href={initial.guestPreviewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit text-label font-semibold text-primary underline-offset-2 hover:underline"
        >
          Eelvaade külalisena ↗
        </a>
      ) : (
        <p className="text-bodySm text-inkMuted">
          Külalise eelvaade tekib pärast esmast salvestamist (kehtib 24 tundi).
        </p>
      )}

      <section className="flex flex-col gap-xs rounded-card border border-border p-sm">
        <h3 className="text-label font-semibold text-ink">Avaldamine</h3>
        {initial.auctionId === null ? (
          <p className="text-bodySm text-inkMuted">
            Salvesta mustand esmalt — avaldamine avaneb pärast seda.
          </p>
        ) : (
          <>
            {warnings.length > 0 ? (
              <WarningNote>
                Avaldamisel jäävad {String(warnings.length)} hoiatust auditisse.
              </WarningNote>
            ) : null}
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="wizard-auditNote">Märkus auditile (valikuline)</FieldLabel>
              <input
                id="wizard-auditNote"
                name="auditNote"
                type="text"
                className={inputClass}
              />
            </div>
            {canPublish ? (
              <button
                type="submit"
                formAction={options.publishAuction}
                className={`${primaryButtonClass} w-fit`}
              >
                Avalda
              </button>
            ) : (
              <button type="button" disabled className={`${primaryButtonClass} w-fit opacity-50`}>
                Avalda
              </button>
            )}
            <FieldHint>
              Avaldamine käivitub serveris: blokeerivad tingimused kontrollitakse seal uuesti.
              Pilt puudumine andmestikus annab hoiatuse, puuduv alternatiivtekst blokeerib.
            </FieldHint>
          </>
        )}
      </section>
    </div>
  )
}
