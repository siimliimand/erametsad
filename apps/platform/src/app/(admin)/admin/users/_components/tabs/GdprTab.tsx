'use client'

import { Download as DownloadIcon, Trash2 as Trash2Icon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  anonymizeUserAction,
  exportUserGdprAction,
  precheckUserDeleteAction,
  type GdprDeletePrecheck,
  type GdprDeleteStatus,
} from '../../../../_actions/users'
import { ConfirmDialog } from '../../../../_components/ui/ConfirmDialog'
import { useToast } from '../../../../_components/ui/Toast'
import { formatDateTime, formatEur } from '../../../../_lib/labels'

const ghostButtonClass =
  'inline-flex h-10 items-center gap-2 rounded-button border border-border bg-bgPage px-4 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'
const dangerButtonClass =
  'inline-flex h-10 items-center gap-2 rounded-button bg-danger px-4 text-label font-semibold text-inkInverse transition-[filter] duration-hover ease-hover hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50'

const reportBoxClass = 'mt-2 space-y-1 rounded-input border border-border bg-bgPage px-3 py-2'

// Second-step guard for the delete flow: the typed keyword is the explicit
// override confirmation demanded by the spec's pre-check scenario.
const DELETE_KEYWORD = 'KUSTUTAN'
const EXPORT_KEYWORD = 'KINNITA'

function PrecheckReport({
  precheck,
  status,
}: {
  precheck: GdprDeletePrecheck
  status: GdprDeleteStatus
}) {
  return (
    <div className={reportBoxClass}>
      {status.phase === 'requested' && status.coolingOffUntil ? (
        <p className="text-bodySm text-ink">
          Kustutustaotlus on ootel. Jäägaeg kestab kuni {formatDateTime(status.coolingOffUntil)}.
          Kasutaja saab taotluse portaalis tühistada.
        </p>
      ) : null}
      <p className="text-bodySm text-ink">
        Aktiivsed pakkumised: {precheck.activeAuctionBids.length}
        {precheck.activeAuctionBids.map((bid) => (
          <span key={bid.bidId} className="block pl-3 text-ink-muted">
            {bid.auctionTitle ?? bid.auctionId} · {formatEur(bid.amountCents)} · {bid.status}
          </span>
        ))}
      </p>
      <p className="text-bodySm text-ink">
        Allkirjastamata lepingud: {precheck.openContracts.length}
      </p>
      <p className="text-bodySm text-ink">
        Avamata suletud pakkumised (kustutatakse): {precheck.unopenedSealedBidCount}
      </p>
      <p className="text-bodySm text-ink">
        Allkirjastatud lepingud: {precheck.signedContractCount} · säilitamine{' '}
        {precheck.retentionYears} aastat
      </p>
      {precheck.blocking ? (
        <p className="text-bodySm text-danger">
          Eelkontroll leidis lahendamist eeldavaid kirjeid; kinnitamine on ülekäigu kinnitus.
        </p>
      ) : null}
    </div>
  )
}

/**
 * GDPR tools (demo 06-users panel-gdpr). Both actions demand a typed reason
 * and a double confirm (spec delta admin-people): export runs after a second
 * keyword dialog; delete shows the pre-check report, then starts (or, after
 * the 14-day cooling-off, executes) the audited deletion. Nothing
 * client-side decides permissions.
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
  const [exportReasonOpen, setExportReasonOpen] = useState(false)
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false)
  const [pendingExportReason, setPendingExportReason] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [pendingDeleteReason, setPendingDeleteReason] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [precheck, setPrecheck] = useState<GdprDeletePrecheck | null>(null)
  const [status, setStatus] = useState<GdprDeleteStatus | null>(null)
  const pushToast = useToast()

  const loadPrecheck = useCallback(() => {
    precheckUserDeleteAction(userId)
      .then((result) => {
        if (result.ok) {
          setPrecheck(result.precheck)
          setStatus(result.status)
        } else {
          pushToast({ title: result.error, tone: 'error' })
        }
      })
      .catch(() => {
        pushToast({ title: 'Eelkontrooli laadimine ebaõnnestus.', tone: 'error' })
      })
  }, [userId, pushToast])

  useEffect(() => {
    if (deleteOpen) loadPrecheck()
  }, [deleteOpen, loadPrecheck])

  const runExport = (reason: string) => {
    setExporting(true)
    exportUserGdprAction(userId, reason)
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

  const runDelete = (reason: string) => {
    setDeleteBusy(true)
    const override = precheck?.blocking === true
    anonymizeUserAction(userId, reason, { override })
      .then((result) => {
        setDeleteBusy(false)
        if (result.ok) {
          setDeleteConfirmOpen(false)
          setDeleteOpen(false)
          pushToast({ title: result.message, tone: 'success' })
          onChanged?.()
        } else {
          pushToast({ title: result.error, tone: 'error' })
        }
      })
      .catch(() => {
        setDeleteBusy(false)
        pushToast({ title: 'Anonüümiseerimine ebaõnnestus.', tone: 'error' })
      })
  }

  return (
    <div className="rounded-card border border-border bg-bgPage p-md">
      <h2 className="font-heading text-h4 font-bold text-ink">Isikuandmete haldus</h2>
      <p className="mt-xs text-bodySm text-ink-muted">
        Eksport koondab kasutaja, profiilid, pakkumised, lepingud (sh allkirjastatud dokumendid),
        õigused, teavitused, nõusolekute logi ja auditimärged üheks ZIP-failiks, mis laaditakse
        otse alla.
      </p>
      <div className="mt-sm flex flex-wrap items-center gap-sm">
        <button
          type="button"
          onClick={() => {
            setExportReasonOpen(true)
          }}
          disabled={exporting}
          className={ghostButtonClass}
        >
          <DownloadIcon className="h-4 w-4" aria-hidden="true" />
          {exporting ? 'Koostan eksporti…' : 'Käivita andmete eksport ZIP'}
        </button>
        {canWrite ? (
          <button
            type="button"
            onClick={() => {
              setDeleteOpen(true)
            }}
            className={dangerButtonClass}
          >
            <Trash2Icon className="h-4 w-4" aria-hidden="true" />
            Käivita konto kustutamine / anonümiseerimine
          </button>
        ) : null}
      </div>
      <p className="mt-sm text-bodySm text-ink-muted">
        Kustutamine nõuab kohustuslikku põhjendust, kahekordset kinnitust ja eelkontrolli aruannet.
        Taotlusele järgneb 14-päevane jäägaeg, mille kasutaja saab portaalis tühistada.
        Lõplikul kustutamisel anonümiseeritakse isikuandmed, pakkumiste ja lepingute read
        pseudonümiseeritakse ning avamata suletud pakkumised kustutatakse. Arveandmed jäävad
        arhiivi 7 aastaks. Mõlemad tegevused logitakse auditilogisse.
      </p>

      <ConfirmDialog
        open={exportReasonOpen}
        onClose={() => {
          setExportReasonOpen(false)
        }}
        title="Andmete eksport"
        description="Eksport sisaldab isikuandmeid, sealhulgas isikukoodi. Toiming logitakse auditilogisse koos põhjendusega."
        variant="reason"
        reasonLabel="Põhjendus (kohustuslik)"
        confirmLabel="Jätka eksporti"
        onConfirm={(reason) => {
          setPendingExportReason(reason)
          setExportReasonOpen(false)
          setExportConfirmOpen(true)
        }}
      />
      <ConfirmDialog
        open={exportConfirmOpen}
        onClose={() => {
          setExportConfirmOpen(false)
        }}
        title="Kinnita eksport uuesti"
        description={`Põhjendus: ${pendingExportReason}`}
        variant="keyword"
        keyword={EXPORT_KEYWORD}
        confirmLabel="Laadi ZIP alla"
        busy={exporting}
        onConfirm={() => {
          setExportConfirmOpen(false)
          runExport(pendingExportReason)
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false)
        }}
        title="Konto kustutamine / anonümiseerimine"
        description={
          precheck && status ? (
            <span>
              Eelkontrooli aruanne:
              <PrecheckReport precheck={precheck} status={status} />
            </span>
          ) : (
            'Laadin eelkontrooli aruannet…'
          )
        }
        note="Taotlus läheb koos põhjendusega auditilogisse; jäägaeg on 14 päeva."
        variant="reason"
        reasonLabel="Põhjendus (kohustuslik)"
        confirmLabel="Jätka kustutamist"
        onConfirm={(reason) => {
          setPendingDeleteReason(reason)
          setDeleteOpen(false)
          setDeleteConfirmOpen(true)
        }}
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false)
        }}
        title="Kinnita kustutamine uuesti"
        description={
          precheck?.blocking
            ? 'Eelkontroll leidis aktiivseid pakkumisi või allkirjastamata lepinguid. Selle kinnitusega nõustute nende jätmisega (ülekäik logitakse).'
            : 'Pärast 14-päevast jääaega anonümiseeritakse isikuandmed pöördumatult.'
        }
        variant="keyword"
        keyword={DELETE_KEYWORD}
        keywordLabel={`Trüki kinnitussõna: ${DELETE_KEYWORD}`}
        confirmLabel="Registreeri kustutustaotlus"
        busy={deleteBusy}
        onConfirm={() => {
          runDelete(pendingDeleteReason)
        }}
      />
    </div>
  )
}
