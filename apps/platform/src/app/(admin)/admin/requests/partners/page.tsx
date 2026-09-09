import { redirect } from 'next/navigation'

import { forwardLegacyQuery } from '../_components/forward-legacy-query'

export default async function PartnersRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  redirect(`/admin/inquiries/partners${forwardLegacyQuery(await searchParams)}`)
}
