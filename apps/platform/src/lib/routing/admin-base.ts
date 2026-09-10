// Host-dependent admin URL base. The admin UI's route space is /admin/...
// internally, but the dedicated admin host serves it prefix-free through a
// middleware rewrite. These constants are shared by server code and client
// components, so this module stays free of server-only imports.

import { ADMIN_HOSTNAME } from './host-areas'

/** Request header middleware sets to '' on the admin host. */
export const ADMIN_BASE_HEADER = 'x-admin-base'

/** Base used whenever the header is absent (default host, workers.dev). */
export const DEFAULT_ADMIN_BASE = '/admin'

/**
 * Joins a base-relative admin path (/auctions, /users/42) with a base.
 * The base-relative convention holds for every href inside the (admin)
 * tree; rendering primitives (AdminLink, DataTable, nav) do the join.
 */
export function joinAdminBase(base: string, path: string): string {
  return `${base}${path}`
}

/**
 * Maps an internal route path (/admin/... — the form revalidatePath and
 * the router use) to the host's URL space: unchanged outside the admin
 * host, prefix-stripped on it.
 */
export function adminUrlFromBase(base: string, internalPath: string): string {
  if (base !== '') return internalPath
  if (internalPath === '/admin') return '/'
  if (internalPath.startsWith('/admin/')) return internalPath.slice('/admin'.length)
  return internalPath
}

/**
 * The admin workspace root URL for a hostname, for full-page navigations
 * outside the AdminBaseProvider (the shared login page routes staff by
 * reading the live hostname). '/' on the prefix-free admin host,
 * '/admin' everywhere else.
 */
export function adminRootForHost(hostname: string | null | undefined): string {
  return hostname === ADMIN_HOSTNAME ? '/' : DEFAULT_ADMIN_BASE
}
