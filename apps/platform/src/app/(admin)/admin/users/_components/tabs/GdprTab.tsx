'use client'

import { Download as DownloadIcon, Trash2 as Trash2Icon } from 'lucide-react'
import { useState } from 'react'

import {
  anonymizeUserAction,
  exportUserGdprAction,
} from '../../../../_actions/users'
import { ConfirmDialog } from '../../../../_components/ui/ConfirmDialog'
import { useToast } from '../../../../_components/ui/Toast'

const ghostButtonClass =
  'inline-flex h-10 items-center gap-2 rounded-button border border-border bg-bgPage px-4 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'
const dangerButtonClass =
  'inline-flex h-10 items-center gap-2 rounded-button bg-danger px-4 text-label font-semibold text-inkInverse transition-[filter] duration-hover ease-hover hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * GDPR tools (demo 06-users panel-gdpr): the export returns a ZIP the
 * browser saves directly; anonymize asks for a mandatory reason and keeps
 * the row for the 7-year accounting retention. Both run audited server
 * actions; nothing client-side decides permissions.
 */
export function GdprTab({
  userId,
  canWrite,
  onChanged,
}: {
  userId: string
  canWrite: boolean
  onChanged?: () => void
}) {
  const [exporting, setExporting] = useState(false)
  const [anonymizeOpen, setAnonymizeOpen] = useState(false)
  const [anonymizeBusy, setAnonymizeBusy] = useState(false)
  const pushToast = useToast()

  const runExport = () => {
    setExporting(true)
    exportUserGdprAction(userId)
      .then((result) => {
        setExporting(false)
        if (!result.ok) {
          pushToast({ title: result.error, tone: 'error' })
          return
        }
        const binary = atob(result.base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }))
        const link = document.createElement('a')
        link.href = url
        link.download = result.filename
        link.click()
        URL.revokeObjectURL(url)
        pushToast({ title: 'Eksport koostatud ja alla laaditud.', tone: 'success' })
      })
      .catch(() => {
        setExporting(false)
        pushToast({ title: 'Eksportimine ebaõnnestus.', tone: 'error' })
      })
  }

  const anonymize = (reason: string) => {
    setAnonymizeBusy(true)
    anonymizeUserAction(userId, reason)
      .then((result) => {
        setAnonymizeBusy(false)
        if (result.ok) {
          setAnonymizeOpen(false)
          pushToast({ title: result.message, tone: 'success' })
          onChanged?.()
        } else {
          pushToast({ title: result.error, tone: 'error' })
        }
      })
      .catch(() => {
        setAnonymizeBusy(false)
        pushToast({ title: 'Anonüümiseerimine ebaõnnestus.', tone: 'error' })
      })
  }

  return (
    <div className="rounded-card border border-border bg-bgPage p-md">
      <h2 className="font-heading text-h4 font-bold text-ink">Isikuandmete haldus</h2>
      <p className="mt-xs text-bodySm text-ink-muted">
        Eksport koondab kasutaja, profiilid, pakkumised, lepingud, õigused, teavitused ja
        auditimärged üheks ZIP-failiks, mis laaditakse otse alla.
      </p>
      <div className="mt-sm flex flex-wrap items-center gap-sm">
        <button type="button" onClick={runExport} disabled={exporting} className={ghostButtonClass}>
          <DownloadIcon className="h-4 w-4" aria-hidden="true" />
          {exporting ? 'Koostan eksporti…' : 'Käivita andmete eksport ZIP'}
        </button>
        {canWrite ? (
          <button
            type="button"
            onClick={() => {
              setAnonymizeOpen(true)
            }}
            className={dangerButtonClass}
          >
            <Trash2Icon className="h-4 w-4" aria-hidden="true" />
            Käivita konto kustutamine / anonümiseerimine
          </button>
        ) : null}
      </div>
      <p className="mt-sm text-bodySm text-ink-muted">
        Kustutamine arvestab 7-aastast raamatupidamislikku säilituskohustust — isikuandmed
        anonümiseeritakse, arveandmed jäävad arhiivi. Mõlemad tegevused logitakse auditilogisse.
      </p>

      <ConfirmDialog
        open={anonymizeOpen}
        onClose={() => {
          setAnonymizeOpen(false)
        }}
        title="Konto kustutamine / anonümiseerimine"
        description="Pärast kinnitamist anonümiseeritakse isikuandmed pöördumatult; arve- ja lepinguandmed arhiveeritakse 7 aastaks."
        note="Kanne läheb koos põhjendusega auditilogisse."
        variant="reason"
        reasonLabel="Põhjendus (kohustuslik)"
        confirmLabel="Kinnita anonümiseerimine"
        busy={anonymizeBusy}
        onConfirm={anonymize}
      />
    </div>
  )
}
