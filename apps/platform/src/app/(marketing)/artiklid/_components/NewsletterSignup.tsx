'use client'

import { Toast } from '@eametsad/ui'
import { useState, type SyntheticEvent } from 'react'

// Local minimal newsletter form for the articles hub. Task 3.1 owns the
// shared NewsletterBlock at (marketing)/_components; until it lands, this
// island posts the same contract (email + honeypot) to /api/v1/newsletter.
const SUCCESS_MESSAGE = 'Kontrolli posti — saatsime kinnitussõnumi'
const ERROR_MESSAGE = 'Tellimus ei õnnestunud. Proovi palun hiljem uuesti'

export function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const honeypotValue = data.get('company_website')
    const honeypot = typeof honeypotValue === 'string' ? honeypotValue : ''
    setPending(true)
    try {
      const response = await fetch('/api/v1/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), company_website: honeypot }),
      })
      if (response.ok) {
        setToast({ type: 'success', message: SUCCESS_MESSAGE })
        setEmail('')
      } else {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setToast({ type: 'error', message: body?.error ?? ERROR_MESSAGE })
      }
    } catch {
      setToast({ type: 'error', message: ERROR_MESSAGE })
    } finally {
      setPending(false)
    }
  }

  return (
    <section
      aria-labelledby="uudiskiri-pealkiri"
      className="rounded-card bg-bgMist p-md md:p-lg"
    >
      <h2 id="uudiskiri-pealkiri" className="font-heading text-h3 text-ink">
        Uudiskiri
      </h2>
      <p className="mt-xs max-w-container-sm text-body text-inkMuted">
        Uued oksjonid, artiklid ja nõuanded metsaomanikule otse sinu postkasti.
      </p>
      <form
        onSubmit={(event) => {
          void handleSubmit(event)
        }}
        className="mt-md flex w-full max-w-md flex-col gap-xs sm:flex-row"
      >
        <label htmlFor="uudiskiri-email" className="sr-only">
          E-posti aadress
        </label>
        <input
          id="uudiskiri-email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
          }}
          placeholder="sinu@email.ee"
          autoComplete="email"
          className="h-12 min-w-0 flex-1 rounded-input border border-border bg-white px-4 text-body text-ink placeholder:text-inkMuted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primaryLight"
        />
        {/* Honeypot: bots fill it, humans never see it. */}
        <input
          type="text"
          name="company_website"
          value=""
          readOnly
          hidden
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-12 shrink-0 rounded-button bg-primary px-6 font-label font-semibold text-inkInverse transition-colors duration-hover ease-hover hover:bg-primaryHover disabled:opacity-60"
        >
          {pending ? 'Laadin…' : 'Liitu'}
        </button>
      </form>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible
          onClose={() => {
            setToast(null)
          }}
        />
      )}
    </section>
  )
}
