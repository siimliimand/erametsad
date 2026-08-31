'use client'

import { useEffect } from 'react'

import { track } from '@/lib/analytics/track'

// Fires the shell-spec `error_404{path}` event once per 404 render, so
// not-found.tsx itself can stay a server component.
export function NotFound404Island() {
  useEffect(() => {
    track('error_404', { path: window.location.pathname })
  }, [])

  return null
}
