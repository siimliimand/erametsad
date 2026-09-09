import { redirect } from 'next/navigation'

import { forwardLegacyQuery } from './_components/forward-legacy-query'

export default async function RequestsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  redirect(`/admin/inquiries${forwardLegacyQuery(await searchParams)}`)
}
