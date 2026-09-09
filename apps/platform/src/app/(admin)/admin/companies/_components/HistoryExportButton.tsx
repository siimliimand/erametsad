'use client'

import { Download } from 'lucide-react'
import { useState } from 'react'

import { exportCompanyHistoryAction } from '../../../_actions/ops'

/**
 * Audited history CSV export (spec delta admin-people). The action re-reads
 * the decided rows server-side, writes the `company.history_export` audit
 * entry, and returns the CSV as base64; this button turns it into a
 * client-side download.
 */
export function HistoryExportButton({
  filters,
  disabled = false,
}: {
  filters: { decision?: string | undefined; date?: string | undefined; q?: string | undefined }
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    setBusy(true)
    setError(null)
    exportCompanyHistoryAction(filters)
      .then((result) => {
        setBusy(false)
        if (!result.ok) {
          setError(result.error)
          return
        }
        const binary = atob(result.base64)
        const bytes = new Uint8Array(binary.length)
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index)
        }
        const url = URL.createObjectURL(new Blob([bytes], { type: 'text/csv' }))
        const link = document.createElement('a')
        link.href = url
        link.download = result.filename
        link.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => {
        setBusy(false)
        setError('Eksportimine ebaõnnestus.')
      })
  }

  return (
    <span className="flex items-center gap-2">
      {error ? <span className="text-label font-semibold text-danger">{error}</span> : null}
      <button
        type="button"
        disabled={disabled || busy}
        onClick={run}
        title={disabled ? 'Eksporditavaid ridu ei ole' : 'Eksport logitakse auditilogisse'}
        className="inline-flex h-9 items-center gap-1.5 rounded-button border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        {busy ? 'Eksordin…' : 'Ekspordi CSV'}
      </button>
    </span>
  )
}
