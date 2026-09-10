import { redirect } from 'next/navigation'

import { forwardLegacyQuery } from './_components/forward-legacy-query'

import { adminUrl } from '@/lib/routing/admin-base-server'

export default async function RequestsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  redirect(await adminUrl(`/admin/inquiries${forwardLegacyQuery(await searchParams)}`))
}
