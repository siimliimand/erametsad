import { redirect } from 'next/navigation'

import { adminUrl } from '@/lib/routing/admin-base-server'

export default async function AdminContentSettingsRedirectPage() {
  redirect(await adminUrl('/admin/settings'))
}
