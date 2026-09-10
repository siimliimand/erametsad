'use client'

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

import { DEFAULT_ADMIN_BASE } from '@/lib/routing/admin-base'

const AdminBaseContext = createContext(DEFAULT_ADMIN_BASE)

/**
 * Provides the host's admin URL base ('' on the admin host, '/admin'
 * elsewhere). The admin layout fills it from the middleware-stamped
 * request header; every base-relative href joins it at render time.
 */
export function AdminBaseProvider({ base, children }: { base: string; children: ReactNode }) {
  return <AdminBaseContext.Provider value={base}>{children}</AdminBaseContext.Provider>
}

export function useAdminBase(): string {
  return useContext(AdminBaseContext)
}
