'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Portals escape the shell root that carries the admin token scope, so the
// portal root re-declares .admin-scope (every token in it is a literal value,
// see admin.css) and the overlay keeps the scoped tokens and focus ring.
export function OverlayPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  if (!mounted) return null
  return createPortal(<div className="admin-scope">{children}</div>, document.body)
}
