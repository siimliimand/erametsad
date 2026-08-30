'use client'

import { useActionState } from 'react'

import { importContentAction } from '../../../../_actions/import-export'
import { FormSelectField, primaryButtonClass } from '../../../../_components/FormField'
import { MAX_IMPORT_BYTES, type ImportReport, type ItemOutcome } from '../_lib/import-export'

const outcomeLabels: Record<ItemOutcome, string> = {
  created: 'Loodud',
  updated: 'Uuendatud',
  'would-create': 'Luuakse',
  'would-update': 'Uuendatakse',
  invalid: 'Vigane',
  failed: 'Ebaõnnestus',
}

const outcomeBadgeClass: Record<ItemOutcome, string> = {
  created: 'bg-primary-light text-primaryDark',
  updated: 'bg-info-light text-info',
  'would-create': 'bg-primary-light text-primaryDark',
  'would-update': 'bg-info-light text-info',
  invalid: 'bg-danger-light text-danger',
  failed: 'bg-danger-light text-danger',
}

const entityLabels: Record<'articles' | 'pages', string> = {
  articles: 'Artikkel',
  pages: 'Leht',
}

export function ImportForm() {
  const [report, formAction, isPending] = useActionState(importContentAction, null)
  const maxMiB = Math.round(MAX_IMPORT_BYTES / (1024 * 1024))

  return (
    <div className="mt-sm">
      <form action={formAction} className="flex flex-col gap-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="field-file" className="text-label font-semibold text-ink">
            JSON-fail
          </label>
          <input
            id="field-file"
            name="file"
            type="file"
            required
            accept=".json,application/json"
            className="text-bodySm text-ink"
          />
          <p className="text-bodySm text-ink-muted">Maks {String(maxMiB)} MiB ja 500 kirjet.</p>
        </div>
        <FormSelectField
          label="Faili tüüp"
          name="entity"
          hint="Kehtib massiivifailidele. Fail võtmetega articles ja pages tunnetatakse automaatselt."
          options={[
            { value: 'articles', label: 'Artiklid' },
            { value: 'pages', label: 'Lehed' },
          ]}
        />
        <label className="flex items-center gap-xs text-bodySm text-ink">
          <input type="checkbox" name="dryRun" value="true" className="h-4 w-4" />
          Kontrolli ilma salvestamata
        </label>
        <button type="submit" className={primaryButtonClass} disabled={isPending}>
          {isPending ? 'Töötlen…' : 'Impordi'}
        </button>
      </form>
      {report ? <ReportView report={report} /> : null}
    </div>
  )
}

function ReportView({ report }: { report: ImportReport }) {
  const summary = report.summary
  return (
    <div className="mt-md">
      <p
        className={
          report.status === 'error'
            ? 'text-bodySm font-semibold text-danger'
            : 'text-bodySm font-semibold text-ink'
        }
      >
        {report.message}
      </p>
      <p className="mt-xs text-bodySm text-ink-muted">
        Kokku: {String(summary.created)} loodud, {String(summary.updated)} uuendatud,{' '}
        {String(summary.failed)} ebaõnnestus.
      </p>
      {report.items.length > 0 ? (
        <ul className="mt-sm divide-y divide-border rounded-card border border-border bg-bgPage">
          {report.items.map((item) => (
            <li
              key={`${item.entity}-${String(item.index)}`}
              className="flex flex-wrap items-center gap-xs px-md py-xs"
            >
              <span
                className={`inline-flex items-center rounded-pill px-2 py-0.5 text-label font-semibold ${outcomeBadgeClass[item.outcome]}`}
              >
                {outcomeLabels[item.outcome]}
              </span>
              <span className="text-bodySm text-ink">
                {entityLabels[item.entity]} #{String(item.index)}: {item.title} ({item.slug})
              </span>
              {item.reason ? <span className="text-bodySm text-danger">{item.reason}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
