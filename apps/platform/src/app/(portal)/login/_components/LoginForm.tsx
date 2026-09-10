'use client'

import { Btn } from '@erametsad/ui'
import { ArrowLeft, Lock } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { AuthField } from './AuthField'
import { PendingCompanyBanner, SuspendedBanner } from './Banners'
import { ControlCodeScreen } from './ControlCodeScreen'
import { EidMethodCards } from './EidMethodCards'
import { PasswordForm } from './PasswordForm'
import {
  completeEid,
  fetchMyProfiles,
  loginWithPassword,
  pollEidStatus,
  startEid,
  type EidMethod,
} from './eid-client'

import { isStaffRole } from '@/app/(admin)/_lib/permissions'
import { adminRootForHost } from '@/lib/routing/admin-base'

const POLL_INTERVAL_MS = 2000
const POLL_MAX_MS = 120000
const MAX_POLL_ERRORS = 3

interface EidSessionState {
  method: EidMethod
  sessionRef: string
  controlCode: string | null
  state: 'pending' | 'success' | 'failed'
}

interface LoginFormProps {
  next: string | null
  privacyHref: string
}

export function LoginForm({ next, privacyHref }: LoginFormProps) {
  const [method, setMethod] = useState<EidMethod | null>(null)
  const [isikukood, setIsikukood] = useState('')
  const [startError, setStartError] = useState<string | null>(null)
  const [eid, setEid] = useState<EidSessionState | null>(null)
  const [banner, setBanner] = useState<'suspended' | 'pendingCompany' | null>(null)
  const [busy, setBusy] = useState(false)

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    return () => {
      cancelledRef.current = true
      if (pollTimerRef.current !== null) clearTimeout(pollTimerRef.current)
    }
  }, [])

  function clearPolling() {
    cancelledRef.current = true
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  // Post-login routing: cookies are already set, so a full navigation keeps
  // server components in sync with the new session. Staff roles skip the
  // buyer profile-selection step and land on the admin workspace.
  async function routeAfterAuth() {
    const target = next ?? '/'
    const mine = await fetchMyProfiles()
    if (mine?.role !== null && mine?.role !== undefined && isStaffRole(mine.role)) {
      window.location.assign(adminRootForHost(window.location.hostname))
      return
    }
    const profiles = mine?.profiles ?? null
    if (profiles && profiles.length > 1) {
      window.location.assign(`/select-profile?next=${encodeURIComponent(target)}`)
      return
    }
    if (profiles) {
      const hasApproved = profiles.some((profile) => profile.approvalStatus === 'approved')
      const hasPendingCompany = profiles.some(
        (profile) => profile.type === 'company' && profile.approvalStatus === 'pending',
      )
      if (!hasApproved && hasPendingCompany) {
        clearPolling()
        setEid(null)
        setBanner('pendingCompany')
        setBusy(false)
        return
      }
    }
    window.location.assign(target)
  }

  async function finishEid(session: EidSessionState) {
    const result = await completeEid(session.method, session.sessionRef)
    if (cancelledRef.current) return
    if (result.ok) {
      // Demo success view: keep it up while the redirect is being prepared.
      setEid({ ...session, state: 'success' })
      await routeAfterAuth()
      return
    }
    clearPolling()
    setEid(null)
    setBusy(false)
    setBanner(result.suspended ? 'suspended' : null)
    setStartError(result.suspended ? null : result.message)
  }

  function runPollLoop(session: EidSessionState, startedAt: number, errors: number) {
    pollTimerRef.current = setTimeout(() => {
      if (cancelledRef.current) return
      void (async () => {
        const status = await pollEidStatus(session.method, session.sessionRef)
        if (cancelledRef.current) return
        if (status === null) {
          if (errors + 1 < MAX_POLL_ERRORS) {
            runPollLoop(session, startedAt, errors + 1)
            return
          }
          setEid((current) => (current ? { ...current, state: 'failed' } : current))
          return
        }
        if (status === 'completed') {
          await finishEid(session)
          return
        }
        if (status === 'pending') {
          if (Date.now() - startedAt < POLL_MAX_MS) {
            runPollLoop(session, startedAt, 0)
            return
          }
          setEid((current) => (current ? { ...current, state: 'failed' } : current))
          return
        }
        setEid((current) => (current ? { ...current, state: 'failed' } : current))
      })()
    }, POLL_INTERVAL_MS)
  }

  async function handleStartEid() {
    if (!method || busy) return
    const code = isikukood.trim()
    if (!/^\d{11}$/.test(code)) {
      setStartError('Sisesta 11-kohaline isikukood.')
      return
    }
    setStartError(null)
    setBusy(true)
    const result = await startEid(method, code)
    setBusy(false)
    if (!result.ok) {
      setBanner(result.suspended ? 'suspended' : null)
      if (!result.suspended) setStartError(result.message)
      return
    }
    cancelledRef.current = false
    const session: EidSessionState = {
      method,
      sessionRef: result.sessionRef,
      controlCode: result.controlCode,
      state: 'pending',
    }
    setEid(session)
    runPollLoop(session, Date.now(), 0)
  }

  function handleCancelEid() {
    clearPolling()
    setEid(null)
    setBusy(false)
  }

  async function handlePasswordSubmit(identifier: string, password: string) {
    const result = await loginWithPassword(identifier, password)
    if (result.ok) {
      await routeAfterAuth()
      return null
    }
    if (result.suspended) {
      setBanner('suspended')
      return null
    }
    return result.message
  }

  const registerHref = next
    ? `/register?next=${encodeURIComponent(next)}`
    : '/register'

  return (
    <div className="flex w-full justify-center">
      <div className="w-full max-w-[440px]">
        <div className="rounded-card border border-border bg-bgPage p-md shadow-card md:p-lg">
          {eid ? (
            <ControlCodeScreen
              method={eid.method}
              controlCode={eid.controlCode}
              state={eid.state}
              onCancel={handleCancelEid}
              onRestart={() => {
                void handleStartEid()
              }}
            />
          ) : (
            <>
              <h1 className="font-heading text-[2rem] font-extrabold leading-tight text-ink">
                Logi sisse
              </h1>
              <p className="mt-1.5 font-body text-bodySm text-inkMuted">
                Vali turvaline tuvastusmeetod — sama konto kehtib nii pakkumiseks kui
                oma metsa müümiseks.
              </p>

              {banner !== null && (
                <div className="mt-md flex flex-col gap-md">
                  {banner === 'suspended' && <SuspendedBanner />}
                  {banner === 'pendingCompany' && <PendingCompanyBanner />}
                </div>
              )}

              <section aria-label="eID autentimine" className="mt-md flex flex-col gap-sm">
                <EidMethodCards
                  selected={method}
                  disabled={busy}
                  onSelect={(selected) => {
                    setMethod(selected)
                    setStartError(null)
                  }}
                />

                <AuthField
                  label="Isikukood"
                  name="eid-isikukood"
                  inputMode="numeric"
                  maxLength={11}
                  autoComplete="username"
                  placeholder="38001010000"
                  disabled={busy || method === null}
                  error={startError}
                  value={isikukood}
                  onChange={(event) => {
                    setIsikukood(event.target.value)
                  }}
                />

                <div className="mt-1 [&_button]:w-full">
                  <Btn
                    onClick={() => void handleStartEid()}
                    isLoading={busy}
                    disabled={method === null}
                  >
                    Jätka
                  </Btn>
                </div>
              </section>

              <div className="my-md flex items-center gap-sm" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="font-label font-semibold uppercase tracking-widest text-inkMuted">
                  või
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <PasswordForm
                next={next}
                disabled={busy}
                onSubmit={handlePasswordSubmit}
              />

              <p className="mt-md border-t border-border pt-md text-center font-body text-bodySm text-inkMuted">
                Pole veel kasutajat?{' '}
                <Link
                  href={registerHref}
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Loo konto
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="mt-xs flex items-start justify-center gap-xs text-center font-body text-bodySm text-inkMuted">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Turvaline sisselogimine EU eIDAS tasemega. Isikuandmeid töödeldakse
            vastavalt GDPR-ile — vaata{' '}
            <a
              href={privacyHref}
              className="text-primary underline-offset-2 hover:underline"
            >
              privaatsuspoliitikat
            </a>
            .
          </span>
        </p>

        <p className="mt-sm text-center font-body text-bodySm">
          <Link
            href="/"
            className="inline-flex items-center gap-xs text-primary underline-offset-2 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Tagasi oksjonitele
          </Link>
        </p>
      </div>
    </div>
  )
}
