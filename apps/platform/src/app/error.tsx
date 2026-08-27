'use client'

import { useEffect } from 'react'

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
    <div role="alert">
      <h2>Midagi läks valesti</h2>
      <p>Juhtus ootamatu viga. Proovi lehte värskendada.</p>
      <button onClick={() => { reset() }}>Proovi uuesti</button>
    </div>
  )
}