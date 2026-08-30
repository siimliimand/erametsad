'use client'

import { Btn } from '@eametsad/ui'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { requestJson } from './api'
import { formatDateTime } from './format'
import { pillActive } from './pills'
import type { SessionView } from './types'

export function SessionsList() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionView[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [revokingOthers, setRevokingOthers] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    requestJson<{ sessions: SessionView[] }>('/api/v1/my/sessions')
      .then((data) => setSessions(data.sessions))
      .catch(() => setError('Sessioonide laadimine ebaõnnestus.'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function revoke(session: SessionView) {
    setBusyId(session.id)
    setError(null)
    try {
      await requestJson(`/api/v1/my/sessions?id=${encodeURIComponent(session.id)}`, {
        method: 'DELETE',
      })
      if (session.current) {
        // Revoking the current session clears the auth cookies server-side.
        router.push('/login')
        return
      }
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sessiooni lõpetamine ebaõnnestus.')
    } finally {
      setBusyId(null)
    }
  }

  async function revokeOthers() {
    if (!sessions) return
    setRevokingOthers(true)
    setError(null)
    const others = sessions.filter((session) => !session.current)
    // No bulk endpoint exists; revoke the other sessions one by one.
    const results = await Promise.allSettled(
      others.map((session) =>
        requestJson(`/api/v1/my/sessions?id=${encodeURIComponent(session.id)}`, {
          method: 'DELETE',
        }),
      ),
    )
    setRevokingOthers(false)
    if (results.some((result) => result.status === 'rejected')) {
      setError('Mõne sessiooni lõpetamine ebaõnnestus.')
    }
    load()
  }

  const othersCount = sessions?.filter((session) => !session.current).length ?? 0

  return (
    <div className="flex flex-col gap-xs border-t border-border pt-sm">
      <div className="flex items-center justify-between gap-sm">
        <p className="text-bodySm font-semibold text-ink">Sessioonid</p>
        {othersCount > 0 && (
          <Btn
            variant="ghost"
            size="sm"
            disabled={revokingOthers}
            onClick={() => {
              void revokeOthers()
            }}
          >
            Logi kõik teised välja
          </Btn>
        )}
      </div>
      {sessions === null ? (
        <p className="text-bodySm text-inkMuted">Laadin sessioone…</p>
      ) : sessions.length === 0 ? (
        <p className="text-bodySm text-inkMuted">Aktiivseid sessioone ei leitud.</p>
      ) : (
        <ul className="flex flex-col gap-2xs">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between gap-sm rounded-input border border-border px-sm py-xs"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2xs text-bodySm font-semibold text-ink">
                  <span className="truncate">Sessioon {session.id.slice(0, 8)}</span>
                  {session.current && <span className={pillActive}>See seade</span>}
                </p>
                <p className="text-bodySm text-inkMuted">
                  Alates {formatDateTime(session.createdAt)}
                </p>
              </div>
              <Btn
                variant="outline"
                size="sm"
                isLoading={busyId === session.id}
                onClick={() => {
                  void revoke(session)
                }}
              >
                Lõpeta
              </Btn>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-bodySm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
