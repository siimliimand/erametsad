'use client'

import { Btn, FormInput } from '@erametsad/ui'
import { useEffect, useRef, useState } from 'react'

import { ControlCodeScreen } from '../../login/_components/ControlCodeScreen'
import { EidMethodCards, METHOD_LABELS } from '../../login/_components/EidMethodCards'
import {
  completeEid,
  pollEidStatus,
  startEid,
  type EidMethod,
} from '../../login/_components/eid-client'

const POLL_INTERVAL_MS = 2000
const POLL_MAX_MS = 120000
const MAX_POLL_ERRORS = 3

const ISIKUKOOD_RE = /^\d{11}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface EidSessionState {
  method: EidMethod
  sessionRef: string
  controlCode: string | null
  state: 'pending' | 'failed'
}

interface StepIdentifyProps {
  onExistingAccount: () => void
  onFallbackContinue: (identity: { email: string; isikukood: string }) => void
}

export function StepIdentify({ onExistingAccount, onFallbackContinue }: StepIdentifyProps) {
  const [method, setMethod] = useState<EidMethod | null>(null)
  const [eidIsikukood, setEidIsikukood] = useState('')
  const [startError, setStartError] = useState<string | null>(null)
  const [eid, setEid] = useState<EidSessionState | null>(null)

  const [email, setEmail] = useState('')
  const [fallbackIsikukood, setFallbackIsikukood] = useState('')
  const [fallbackError, setFallbackError] = useState<string | null>(null)

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

  // With the committed eID endpoints a session only completes for an
  // already-registered isikukood. That account belongs in /login, so the
  // wizard short-circuits there instead of continuing registration.
  async function finishEid(session: EidSessionState) {
    const result = await completeEid(session.method, session.sessionRef)
    if (cancelledRef.current) return
    if (result.ok) {
      onExistingAccount()
      return
    }
    clearPolling()
    setEid(null)
    setStartError(result.message)
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
    if (!method) return
    const code = eidIsikukood.trim()
    if (!ISIKUKOOD_RE.test(code)) {
      setStartError('Sisesta 11-kohaline isikukood.')
      return
    }
    setStartError(null)
    const result = await startEid(method, code)
    if (!result.ok) {
      setStartError(result.message)
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
  }

  function handleFallbackContinue() {
    const mail = email.trim()
    const code = fallbackIsikukood.trim()
    if (!EMAIL_RE.test(mail)) {
      setFallbackError('Sisesta korrektne e-posti aadress.')
      return
    }
    if (!ISIKUKOOD_RE.test(code)) {
      setFallbackError('Sisesta 11-kohaline isikukood.')
      return
    }
    setFallbackError(null)
    onFallbackContinue({ email: mail, isikukood: code })
  }

  if (eid) {
    return (
      <ControlCodeScreen
        methodLabel={METHOD_LABELS[eid.method]}
        controlCode={eid.controlCode}
        state={eid.state}
        onCancel={handleCancelEid}
        onRestart={() => {
          void handleStartEid()
        }}
      />
    )
  }

  return (
    <section aria-label="Isiku tuvastamine" className="mt-md flex flex-col gap-md">
      <div className="flex flex-col gap-2xs">
        <h2 className="font-heading text-h3 text-ink">Tuvasta enda isik</h2>
        <p className="font-body text-body text-inkMuted">
          Vali eID autentimisviis või jätka e-posti ja isikukoodiga.
        </p>
      </div>

      <div className="flex flex-col gap-sm">
        <h3 className="font-heading text-h4 text-ink">Tuvastu eID-ga</h3>
        <EidMethodCards
          selected={method}
          disabled={false}
          onSelect={(selected) => {
            setMethod(selected)
            setStartError(null)
          }}
        />

        <FormInput
          label="Isikukood"
          name="eid-isikukood"
          inputMode="numeric"
          maxLength={11}
          autoComplete="off"
          disabled={method === null}
          {...(startError ? { error: startError } : {})}
          value={eidIsikukood}
          onChange={(event) => {
            setEidIsikukood(event.target.value)
          }}
        />

        <Btn
          onClick={() => void handleStartEid()}
          disabled={method === null}
        >
          Jätka eID-ga
        </Btn>
      </div>

      <div className="my-2xs flex items-center gap-sm" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="font-label text-inkMuted">või</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-sm">
        <h3 className="font-heading text-h4 text-ink">Jätka e-posti ja isikukoodiga</h3>

        <FormInput
          label="E-post"
          name="register-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
          }}
        />

        <FormInput
          label="Isikukood"
          name="register-isikukood"
          inputMode="numeric"
          maxLength={11}
          autoComplete="off"
          {...(fallbackError ? { error: fallbackError } : {})}
          value={fallbackIsikukood}
          onChange={(event) => {
            setFallbackIsikukood(event.target.value)
          }}
        />

        <Btn variant="outline" onClick={handleFallbackContinue}>
          Jätka
        </Btn>
      </div>
    </section>
  )
}
