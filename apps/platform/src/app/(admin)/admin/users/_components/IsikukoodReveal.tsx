'use client'

import { useState, useTransition } from 'react'

import { revealIsikukoodAction } from '../../../_actions/users'

/**
 * Masked isikukood with audited click-to-reveal (design D5). The plaintext
 * value never travels from the server until the server action has written
 * the `user.identity_view` audit entry; the first click only arms the
 * confirmation.
 */
export function IsikukoodReveal({ userId, masked }: { userId: string; masked: string }) {
  const [value, setValue] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleReveal(): void {
    if (value !== null) return
    if (!confirming) {
      setConfirming(true)
      return
    }
    startTransition(async () => {
      const result = await revealIsikukoodAction(userId)
      if (result.ok) {
        setValue(result.value)
        setError(null)
      } else {
        setError(result.error)
        setConfirming(false)
      }
    })
  }

  if (value !== null) {
    return (
      <span className="font-mono text-bodySm text-ink" aria-label="Isikukood">
        {value}
      </span>
    )
  }

  return (
    <span className="flex flex-wrap items-center gap-sm">
      <span className="font-mono text-bodySm text-ink-muted">{masked}</span>
      <button
        type="button"
        onClick={handleReveal}
        disabled={pending}
        aria-expanded={confirming}
        className="text-label font-semibold text-primary underline decoration-dotted underline-offset-2 transition-colors duration-hover ease-hover hover:text-primaryHover disabled:opacity-50"
      >
        {pending ? 'Paljastan…' : confirming ? 'Kinnita paljastamine' : 'Näita'}
      </button>
      {confirming && !pending ? (
        <button
          type="button"
          onClick={() => {
            setConfirming(false)
          }}
          className="text-label text-ink-muted transition-colors duration-hover ease-hover hover:text-ink"
        >
          Tühista
        </button>
      ) : null}
      {error ? (
        <span role="alert" className="text-bodySm text-danger">
          {error}
        </span>
      ) : null}
    </span>
  )
}
