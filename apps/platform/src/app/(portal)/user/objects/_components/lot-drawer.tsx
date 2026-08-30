'use client'

import { Btn, Drawer } from '@eametsad/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { ApiError, requestJson } from './api'
import { formatDateTime, formatEur } from './format'
import type { SellerAuctionRow, UnderbidEntry } from './seller-data'

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}

/** SSR renders the absolute time; after mount it upgrades to a relative label. */
export function RelativeTime({ iso }: { iso: string }) {
  const mounted = useMounted()
  const absolute = formatDateTime(iso)
  if (!mounted) return <span>{absolute}</span>
  const diffMs = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diffMs)) return <span>{absolute}</span>
  const minutes = Math.floor(diffMs / 60000)
  let relative: string
  if (minutes < 1) relative = 'just nüüd'
  else if (minutes < 60) relative = `${String(minutes)} min tagasi`
  else if (minutes < 24 * 60)
    relative = `${String(Math.floor(minutes / 60))} h tagasi`
  else relative = absolute
  return (
    <span title={absolute}>
      {relative}
    </span>
  )
}

function AutobidMarker() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-pill bg-primaryLight px-1.5 py-0.5 text-label font-semibold text-primaryDark">
      Automaatpakkuja
    </span>
  )
}

function conflictMessage(raw: string): string {
  const lowered = raw.toLowerCase()
  if (lowered.includes('not active')) {
    return 'Oksjon ei ole enam aktiivne. Alapakkumist ei saa enam kinnitada ega tagasi lükata.'
  }
  return 'See pakkumus ei ole enam kinnitamise ootel. Pakkumuste olukord on vahepeal muutunud.'
}

interface LotDrawerProps {
  row: SellerAuctionRow
  onClose: () => void
}

export function LotDrawer({ row, onClose }: LotDrawerProps) {
  const router = useRouter()
  const [handled, setHandled] = useState<ReadonlySet<string>>(() => new Set())
  const [confirming, setConfirming] = useState<{
    bidId: string
    action: 'approve' | 'reject'
  } | null>(null)
  const [busyBid, setBusyBid] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [conflict, setConflict] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pending = row.pending.filter((entry) => !handled.has(entry.bidId))
  const history = row.bidLog

  async function decide(entry: UnderbidEntry, action: 'approve' | 'reject') {
    if (busyBid !== null) return
    setBusyBid(entry.bidId)
    setError(null)
    setNotice(null)
    setConflict(null)
    try {
      await requestJson(
        `/api/v1/my-auctions/${row.id}/underbids/${entry.bidId}/${action}`,
        { method: 'POST', body: JSON.stringify({}) },
      )
      setHandled((previous) => new Set(previous).add(entry.bidId))
      setNotice(
        action === 'approve'
          ? `Alapakkumine ${formatEur(entry.amount)} on kinnitatud. Pakkuja sai teavituse.`
          : `Alapakkumine ${formatEur(entry.amount)} on tagasi lükatud. Pakkuja sai teavituse.`,
      )
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflict(conflictMessage(err.message))
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Otsuse salvestamine ebaõnnestus. Proovige uuesti.',
        )
      }
    } finally {
      setBusyBid(null)
      setConfirming(null)
    }
  }

  return (
    <Drawer isOpen onClose={onClose} title={row.title} width="w-full max-w-md">
      <div className="flex flex-col gap-md">
        <section aria-label="Alapakkumiste järjekord" className="flex flex-col gap-xs">
          <h3 className="text-body font-semibold text-ink">
            Alapakkumised ({pending.length})
          </h3>
          {pending.length === 0 ? (
            <p className="text-bodySm text-inkMuted">Alapakkumisi pole kinnitamise ootel.</p>
          ) : (
            <ul className="flex flex-col">
              {pending.map((entry) => (
                <li
                  key={entry.bidId}
                  className="flex flex-col gap-xs border-b border-border py-xs last:border-b-0"
                >
                  <div className="flex flex-wrap items-center gap-xs">
                    <span className="text-body font-semibold text-ink">
                      {formatEur(entry.amount)}
                    </span>
                    <span className="text-bodySm text-inkMuted">{entry.label}</span>
                    {entry.isAutobid && <AutobidMarker />}
                    <span className="ml-auto text-bodySm text-inkMuted">
                      <RelativeTime iso={entry.createdAt} />
                    </span>
                  </div>
                  {confirming?.bidId === entry.bidId ? (
                    <div className="rounded-button border border-border bg-bgMist p-xs">
                      <p className="text-bodySm text-ink">
                        {confirming.action === 'approve'
                          ? `Kas kinnitate pakkumuse ${formatEur(entry.amount)}? See saab oksjoni juhtivaks pakkumuseks ja pakkuja teavitatakse.`
                          : `Kas lükkate pakkumuse ${formatEur(entry.amount)} tagasi? Pakkuja teavitatakse.`}
                      </p>
                      <div className="mt-2xs flex gap-xs">
                        <Btn
                          size="sm"
                          isLoading={busyBid === entry.bidId}
                          disabled={busyBid !== null}
                          onClick={() => {
                            void decide(entry, confirming.action)
                          }}
                        >
                          {confirming.action === 'approve' ? 'Jah, kinnita' : 'Jah, lükka tagasi'}
                        </Btn>
                        <Btn
                          size="sm"
                          variant="outline"
                          disabled={busyBid !== null}
                          onClick={() => {
                            setConfirming(null)
                          }}
                        >
                          Katkesta
                        </Btn>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-xs">
                      <Btn
                        size="sm"
                        disabled={busyBid !== null}
                        onClick={() => {
                          setConfirming({ bidId: entry.bidId, action: 'approve' })
                        }}
                      >
                        Kinnita
                      </Btn>
                      <Btn
                        size="sm"
                        variant="outline"
                        disabled={busyBid !== null}
                        onClick={() => {
                          setConfirming({ bidId: entry.bidId, action: 'reject' })
                        }}
                      >
                        Tagasi lükka
                      </Btn>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {conflict !== null && (
            <div role="alert" className="rounded-button border border-danger bg-dangerLight p-xs">
              <p className="text-bodySm font-semibold text-danger">Konflikt</p>
              <p className="text-bodySm text-ink">{conflict}</p>
              <div className="mt-2xs flex gap-xs">
                <Btn
                  size="sm"
                  onClick={() => {
                    setConflict(null)
                    router.refresh()
                  }}
                >
                  Uuenda andmeid
                </Btn>
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setConflict(null)
                  }}
                >
                  Sulge teade
                </Btn>
              </div>
            </div>
          )}
          {notice !== null && (
            <p role="status" className="text-bodySm font-semibold text-statusActive">
              {notice}
            </p>
          )}
          {error !== null && (
            <p role="alert" className="text-bodySm text-danger">
              {error}
            </p>
          )}
        </section>

        <section aria-label="Pakkumuste ajalugu" className="flex flex-col gap-xs">
          <h3 className="text-body font-semibold text-ink">Pakkumuste ajalugu</h3>
          {history.length === 0 ? (
            <p className="text-bodySm text-inkMuted">Pakkumisi pole veel tehtud.</p>
          ) : (
            <ul className="flex flex-col">
              {history.map((entry) => (
                <li
                  key={entry.bidId}
                  className="flex flex-wrap items-center gap-xs border-b border-border py-2xs last:border-b-0"
                >
                  <span className="text-body font-semibold text-ink">
                    {formatEur(entry.amount)}
                  </span>
                  <span className="text-bodySm text-inkMuted">{entry.label}</span>
                  {entry.isAutobid && <AutobidMarker />}
                  <span className="ml-auto text-bodySm text-inkMuted">
                    <RelativeTime iso={entry.createdAt} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-label text-inkMuted">
            Pakkumised on anonümiseeritud. Pakkujate isikuandmeid ei näidata.
          </p>
        </section>
      </div>
    </Drawer>
  )
}
