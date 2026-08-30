'use client'

import { Btn } from '@eametsad/ui'
import { useEffect, useState } from 'react'

import { ApiError, requestJson } from './api'
import { formatDate } from './format'
import { pillActive, pillInfo, pillMuted } from './pills'
import type { ObjectTypeView, RightView } from './types'

const objectTypeLabels: Record<ObjectTypeView, string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Kinnistu',
  kiire: 'Kiire oksjon',
  pakett: 'Pakett',
}

export function RightsMatrix() {
  const [rights, setRights] = useState<RightView[] | null>(null)
  const [pendingRequests, setPendingRequests] = useState<ReadonlySet<string>>(new Set())
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [busyType, setBusyType] = useState<ObjectTypeView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    requestJson<{ rights: RightView[] }>('/api/v1/my/auction-rights')
      .then((data) => {
        if (active) setRights(data.rights)
      })
      .catch(() => {
        if (active) setLoadError('Õiguste laadimine ebaõnnestus.')
      })
    return () => {
      active = false
    }
  }, [])

  async function requestRight(objectType: ObjectTypeView) {
    setBusyType(objectType)
    setRowErrors(({ [objectType]: _cleared, ...rest }) => rest)
    try {
      await requestJson('/api/v1/my/rights-requests', {
        method: 'POST',
        body: JSON.stringify({ objectType }),
      })
      setPendingRequests((prev) => new Set(prev).add(objectType))
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // A pending request already exists, so the row also moves to menetluses.
        setPendingRequests((prev) => new Set(prev).add(objectType))
        setRowErrors((prev) => ({ ...prev, [objectType]: err.message }))
      } else {
        setRowErrors((prev) => ({
          ...prev,
          [objectType]:
            err instanceof Error ? err.message : 'Taotluse esitamine ebaõnnestus.',
        }))
      }
    } finally {
      setBusyType(null)
    }
  }

  return (
    <section aria-labelledby="rights-heading" className="flex flex-col gap-sm">
      <h2 id="rights-heading" className="font-heading text-h4 text-ink">
        Pakkujaõigused
      </h2>
      <div className="overflow-x-auto rounded-card border border-border bg-bgPage shadow-card">
        <table className="w-full min-w-md text-left">
          <thead>
            <tr className="border-b border-border bg-bgMist">
              <th scope="col" className="px-md py-xs text-label font-semibold text-inkMuted">
                Oksjoniliik
              </th>
              <th scope="col" className="px-md py-xs text-label font-semibold text-inkMuted">
                Olek
              </th>
              <th scope="col" className="px-md py-xs text-label font-semibold text-inkMuted">
                Tegevus
              </th>
            </tr>
          </thead>
          <tbody>
            {rights === null ? (
              <tr>
                <td colSpan={3} className="px-md py-sm text-bodySm text-inkMuted">
                  Laadin õigusi…
                </td>
              </tr>
            ) : (
              rights.map((right) => {
                const isPending = pendingRequests.has(right.objectType)
                const rowError = rowErrors[right.objectType]
                return (
                  <tr key={right.objectType} className="border-b border-border last:border-b-0">
                    <td className="px-md py-xs text-bodySm font-semibold text-ink">
                      {objectTypeLabels[right.objectType]}
                    </td>
                    <td className="px-md py-xs">
                      {right.granted ? (
                        <span className={pillActive}>
                          Õigus antud
                          {right.grantedAt ? ` · ${formatDate(right.grantedAt)}` : ''}
                        </span>
                      ) : isPending ? (
                        <span className={pillInfo}>Taotlus menetluses</span>
                      ) : (
                        <span className={pillMuted}>Õigus puudub</span>
                      )}
                    </td>
                    <td className="px-md py-xs">
                      {!right.granted && !isPending && (
                        <Btn
                          variant="outline"
                          size="sm"
                          isLoading={busyType === right.objectType}
                          onClick={() => {
                            void requestRight(right.objectType)
                          }}
                        >
                          Taotle õigust
                        </Btn>
                      )}
                      {rowError && (
                        <p role="alert" className="mt-2xs text-bodySm text-danger">
                          {rowError}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {loadError && (
        <p role="alert" className="text-bodySm text-danger">
          {loadError}
        </p>
      )}
      <p className="text-bodySm text-inkMuted">
        Õiguse annab administraator pärast taotluse menetlemist.
      </p>
    </section>
  )
}
