'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * Portal logout: clears the auth cookies server-side and returns to the
 * public home page. Lives in its own "use server" module because inline
 * server actions are not allowed inside client components.
 */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('access_token')
  cookieStore.delete('refresh_token')
  redirect('/')
}
