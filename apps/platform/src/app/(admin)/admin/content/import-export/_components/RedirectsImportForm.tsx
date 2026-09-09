'use client'

import { useActionState } from 'react'

import { importRedirectsCsvAction } from '../../../../_actions/content'
import { primaryButtonClass } from '../../../../_components/FormField'
import {
  MAX_REDIRECT_IMPORT_ITEMS,
  sampleRedirectsCsv,
  type RedirectImportReport,
} from '../_lib/redirects-csv'

const outcomeLabels: Record<RedirectImportReport['items'][number]['outcome'], string> = {
  created: 'Loodud',
  updated: 'Uuendatud',
  'would-create': 'Luuakse',
  'would-update': 'Uuendatakse',
  invalid: 'Vigane',
  failed: 'Ebaõnnestus',
}

const outcomeBadgeClass: Record<RedirectImportReport['items'][number]['outcome'], string> = {
  created: 'bg-primary-light text-primaryDark',
  updated: 'bg-info-light text-info',
  'would-create': 'bg-primary-light text-primaryDark',
  'would-update': 'bg-info-light text-info',
  invalid: 'bg-danger-light text-danger',
  failed: 'bg-danger-light text-danger',
}

export function RedirectsImportForm() {
  const [report, formAction, isPending] = useActionState(importRedirectsCsvAction, null)
  const maxMiB = 2

  return (
    <div className="mt-sm">
      <form action={formAction} className="flex flex-col gap-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="redirects-csv-file" className="text-label font-semibold text-ink">
            CSV-fail
          </label>
          <input
            id="redirects-csv-file"
            name="file"
            type="file"
            required
            accept=".csv,text/csv"
            className="text-bodySm text-ink"
          />
          <p className="text-bodySm text-ink-muted">
            Päis <code>from,to,type,active</code>, siis üks suunamine rea kohta. Maks{' '}
            {String(maxMiB)} MiB ja {String(MAX_REDIRECT_IMPORT_ITEMS)} kirjet. Olemasoleva
            algusteega rida uueneb.
          </p>
        </div>
        <label className="flex items-center gap-xs text-bodySm text-ink">
          <input type="checkbox" name="dryRun" value="true" className="h-4 w-4" />
          Kontrolli ilma salvestamata
        </label>
        <button type="submit" className={primaryButtonClass} disabled={isPending}>
          {isPending ? 'Töötlen…' : 'Impordi suunamised'}
        </button>
      </form>
      <details className="mt-xs text-bodySm text-ink-muted">
        <summary className="cursor-pointer">Näidisfail</summary>
        <pre className="mt-1 overflow-auto rounded-input bg-bgMist p-2 font-mono text-[12px]">
          {sampleRedirectsCsv}
        </pre>
      </details>
      {report ? <RedirectsReportView report={report} /> : null}
    </div>
  )
}

function RedirectsReportView({ report }: { report: RedirectImportReport }) {
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
              key={String(item.index)}
              className="flex flex-wrap items-center gap-xs px-md py-xs"
            >
              <span
                className={`inline-flex items-center rounded-pill px-2 py-0.5 text-label font-semibold ${outcomeBadgeClass[item.outcome]}`}
              >
                {outcomeLabels[item.outcome]}
              </span>
              <span className="text-bodySm text-ink">
                #{String(item.index)}: {item.from} → {item.to}
              </span>
              {item.reason ? <span className="text-bodySm text-danger">{item.reason}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
