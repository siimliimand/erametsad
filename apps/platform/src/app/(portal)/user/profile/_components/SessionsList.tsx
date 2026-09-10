'use client'

import { Btn } from '@erametsad/ui'
import { LogOut, Monitor } from 'lucide-react'
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
      .then((data) => {
        setSessions(data.sessions)
      })
      .catch(() => {
        setError('Sessioonide laadimine ebaõnnestus.')
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function revoke(session: SessionView) {
    setBusyId(session.id)
    setError(null)
    try {
      await requestJson(
        `/api/v1/my/sessions?id=${encodeURIComponent(session.id)}`,
        {
          method: 'DELETE',
        },
      )
      if (session.current) {
        // Revoking the current session clears the auth cookies server-side.
        router.push('/login')
        return
      }
      load()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Sessiooni lõpetamine ebaõnnestus.',
      )
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
        requestJson(
          `/api/v1/my/sessions?id=${encodeURIComponent(session.id)}`,
          {
            method: 'DELETE',
          },
        ),
      ),
    )
    setRevokingOthers(false)
    if (results.some((result) => result.status === 'rejected')) {
      setError('Mõne sessiooni lõpetamine ebaõnnestus.')
    }
    load()
  }

  const othersCount =
    sessions?.filter((session) => !session.current).length ?? 0

  return (
    <div className="flex flex-col">
      {sessions === null ? (
        <p className="text-bodySm text-inkMuted">Laadin sessioone…</p>
      ) : sessions.length === 0 ? (
        <p className="text-bodySm text-inkMuted">
          Aktiivseid sessioone ei leitud.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center gap-sm border-b border-border py-3.5 last:border-b-0"
            >
              <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-button bg-bgMist text-primary">
                <Monitor size={17} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 basis-[240px]">
                <p className="m-0 flex items-center gap-2 text-bodySm font-semibold text-ink">
                  <span className="truncate">
                    Sessioon {session.id.slice(0, 8)}
                  </span>
                </p>
                <p className="m-0 mt-0.5 text-bodySm text-inkMuted">
                  Alates {formatDateTime(session.createdAt)}
                </p>
              </div>
              {session.current ? (
                <span className={pillActive}>See seanss</span>
              ) : (
                <Btn
                  variant="ghost"
                  size="sm"
                  type="button"
                  isLoading={busyId === session.id}
                  onClick={() => {
                    void revoke(session)
                  }}
                >
                  Lõpeta
                </Btn>
              )}
            </li>
          ))}
        </ul>
      )}

      {othersCount > 0 && (
        <div className="mt-2 flex flex-wrap justify-end">
          <Btn
            variant="outline"
            size="sm"
            type="button"
            disabled={revokingOthers}
            onClick={() => {
              void revokeOthers()
            }}
          >
            <LogOut size={15} aria-hidden="true" />
            Logi välja teistest seanssidest
          </Btn>
        </div>
      )}

      {error !== null && (
        <p role="alert" className="text-bodySm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
