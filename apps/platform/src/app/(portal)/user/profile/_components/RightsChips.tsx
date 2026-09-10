'use client'

import { Btn } from '@erametsad/ui'
import { Check, Info, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ProfileCardShell } from './ProfileCardShell'
import { ApiError, requestJson } from './api'
import { formatDate } from './format'
import type { ObjectTypeView, RightView } from './types'

const objectTypeLabels: Record<ObjectTypeView, string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Kinnistu',
  kiire: 'Kiire oksjon',
  pakett: 'Pakett',
}

const rightChipBase =
  'inline-flex items-center gap-2 rounded-pill px-[15px] py-[7px] text-bodySm font-semibold'
const rightChipOn = `${rightChipBase} bg-primaryLight text-primaryDark`
const rightChipOff = `${rightChipBase} bg-bgMist text-inkMuted`

export function RightsChips() {
  const [rights, setRights] = useState<RightView[] | null>(null)
  const [pendingRequests, setPendingRequests] = useState<ReadonlySet<string>>(
    new Set(),
  )
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
        // A pending request already exists, so the chip also moves to menetluses.
        setPendingRequests((prev) => new Set(prev).add(objectType))
        setRowErrors((prev) => ({ ...prev, [objectType]: err.message }))
      } else {
        setRowErrors((prev) => ({
          ...prev,
          [objectType]:
            err instanceof Error
              ? err.message
              : 'Taotluse esitamine ebaõnnestus.',
        }))
      }
    } finally {
      setBusyType(null)
    }
  }

  return (
    <ProfileCardShell
      labelledBy="profile-rights-heading"
      title="Oksjoniõigused"
      subtitle="Pakkumisõigus oksjoniliikide kaupa."
    >
      {rights === null ? (
        <p className="text-bodySm text-inkMuted">Laadin õigusi…</p>
      ) : (
        <ul
          role="list"
          aria-label="Pakkumisõigused"
          className="m-0 flex list-none flex-wrap gap-2.5 p-0"
        >
          {rights.map((right) => {
            const isPending = pendingRequests.has(right.objectType)
            const rowError = rowErrors[right.objectType]
            return (
              <li
                key={right.objectType}
                className="flex max-w-full flex-wrap items-center gap-2"
              >
                <span className={right.granted ? rightChipOn : rightChipOff}>
                  {right.granted ? (
                    <Check size={12} aria-hidden="true" />
                  ) : (
                    <Minus size={12} aria-hidden="true" />
                  )}
                  {objectTypeLabels[right.objectType]}
                  {right.granted && right.grantedAt !== null && (
                    <small className="font-medium opacity-80">
                      · alates {formatDate(right.grantedAt)}
                    </small>
                  )}
                  {!right.granted && isPending && (
                    <small className="font-medium opacity-80">
                      · Taotlus menetluses
                    </small>
                  )}
                </span>
                {!right.granted && !isPending && (
                  <Btn
                    variant="ghost"
                    size="sm"
                    type="button"
                    isLoading={busyType === right.objectType}
                    onClick={() => {
                      void requestRight(right.objectType)
                    }}
                  >
                    Taotle õigust
                  </Btn>
                )}
                {rowError !== undefined && (
                  <p role="alert" className="text-bodySm text-danger">
                    {rowError}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {loadError !== null && (
        <p role="alert" className="text-bodySm text-danger">
          {loadError}
        </p>
      )}
      <p className="mt-4 flex items-start gap-2.5 text-bodySm text-inkMuted">
        <Info
          size={14}
          aria-hidden="true"
          className="mt-1 shrink-0 text-info"
        />
        <span>
          Õigusi saab taotleda Erametsad meeskonnalt. Enne metsakinnistute
          pakkumist tuleb allkirjastada raamleping.
        </span>
      </p>
    </ProfileCardShell>
  )
}
