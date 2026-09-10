import { redirect } from 'next/navigation'

import { forwardLegacyQuery } from '../_components/forward-legacy-query'

import { adminUrl } from '@/lib/routing/admin-base-server'

export default async function PartnersRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  redirect(await adminUrl(`/admin/inquiries/partners${forwardLegacyQuery(await searchParams)}`))
}
