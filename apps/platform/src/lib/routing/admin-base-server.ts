import { headers } from 'next/headers'

import { ADMIN_BASE_HEADER, DEFAULT_ADMIN_BASE, adminUrlFromBase } from './admin-base'

/**
 * Server-side base lookup. Middleware stamps admin-host requests with an
 * empty base (prefix-free URL space); every other host leaves the header
 * unset and the app keeps its /admin URLs. Outside a request scope (unit
 * tests, queue consumers) there is no request to inspect, so the internal
 * /admin URL space is the fallback.
 */
export async function getAdminBase(): Promise<string> {
  try {
    return (await headers()).get(ADMIN_BASE_HEADER) ?? DEFAULT_ADMIN_BASE
  } catch {
    return DEFAULT_ADMIN_BASE
  }
}

/**
 * Converts an internal route path (/admin/...) into the redirect target for
 * the current host. Server actions call this before next/navigation's
 * redirect so the browser never lands on a /admin URL on the admin host.
 */
export async function adminUrl(internalPath: string): Promise<string> {
  return adminUrlFromBase(await getAdminBase(), internalPath)
}
