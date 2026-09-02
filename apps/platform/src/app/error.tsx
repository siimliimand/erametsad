'use client'

import { useEffect } from 'react'

// The boundary renders client-side and Settings is a server-side,
// admin-guarded repository, so contact data is a static fallback matching
// the seeded FAQ copy (klienditugi): info@erametsad.ee / +372 6000 000.
// Revisit if the shell exposes public contact settings.
const CONTACT_PHONE = '+372 6000 000'
const CONTACT_PHONE_HREF = 'tel:+3726000000'
const CONTACT_EMAIL = 'info@erametsad.ee'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Page render error', { error: error.message, stack: error.stack, digest: error.digest })
  }, [error])

  return (
    <div
      role="alert"
      className="flex min-h-screen items-center justify-center bg-bgPage px-md py-xl"
    >
      <div className="w-full max-w-container-sm rounded-card bg-white p-md text-center shadow-card md:p-lg">
        <h2 className="font-heading text-h2 font-bold text-primaryDark">
          Süsteemi häire, töötame selle kallal
        </h2>
        <p className="mt-xs text-body text-ink">
          Telefon:{' '}
          <a
            href={CONTACT_PHONE_HREF}
            className="text-primary underline transition-colors duration-hover hover:text-primaryHover"
          >
            {CONTACT_PHONE}
          </a>{' '}
          · E-post:{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-primary underline transition-colors duration-hover hover:text-primaryHover"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
        <button
          type="button"
          onClick={() => { reset() }}
          className="mt-md inline-flex h-12 items-center justify-center rounded-button bg-cta px-6 font-label font-semibold text-ink transition-colors duration-hover ease-hover hover:bg-cta-hover"
        >
          Proovi uuesti
        </button>
      </div>
    </div>
  )
}
