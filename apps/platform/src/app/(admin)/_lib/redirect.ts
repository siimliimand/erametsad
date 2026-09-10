import { redirect } from 'next/navigation'

import { adminUrl } from '@/lib/routing/admin-base-server'

/**
 * Redirects to an internal admin route path (/admin/...) translated to the
 * current host's URL space. Typed `Promise<never>` so callers can
 * `return redirectWithError(...)`-style and keep control-flow narrowing:
 * a returned Promise<never> is assignable everywhere and ends the branch.
 */
export async function redirectToAdmin(internalPath: string): Promise<never> {
  redirect(await adminUrl(internalPath))
}
