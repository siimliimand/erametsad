import { ContactBand, type ContactBandContact } from '@erametsad/ui'
import type { Metadata } from 'next'

import { CookieBanner } from './_components/CookieBanner'
import { MarketingFooter } from './_components/MarketingFooter'
import { MarketingHeader } from './_components/MarketingHeader'
import { MARKETING_BASE_URL } from './_lib/base-url'

import { publicContext } from '@/lib/data/guards'
import { getRepositories } from '@/lib/data/runtime'

export const metadata: Metadata = {
  metadataBase: new URL(MARKETING_BASE_URL),
  title: {
    default: 'Erametsad',
    template: '%s | Erametsad',
  },
  description: 'Eesti metsatehingute platvorm',
}

// Settings holds no org contact columns yet (only orgName/orgRegCode/
// orgAddress), so the band is fed from active specialists, whose shape
// matches ContactBandContact. Skipped on builds without a D1 binding.
async function fetchBandContacts(): Promise<ContactBandContact[]> {
  try {
    const repositories = await getRepositories(publicContext)
    const { docs } = await repositories.find({
      collection: 'specialists',
      where: { active: { equals: true } },
      limit: 3,
    })
    return docs.map((specialist) => ({
      name: specialist.name,
      role: specialist.role ?? '',
      ...(specialist.phone !== null && { phone: specialist.phone }),
      ...(specialist.email !== null && { email: specialist.email }),
    }))
  } catch {
    return []
  }
}

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const contacts = await fetchBandContacts()

  return (
    <>
      <MarketingHeader />
      {/* Skip-link target from MarketingHeader (task 2.2). */}
      <main id="peasisu">{children}</main>
      {contacts.length > 0 && (
        <ContactBand
          title="Võta ühendust"
          description="Kirjuta või helista — vastame 1 tööpäeva jooksul."
          contacts={contacts}
        />
      )}
      <MarketingFooter />
      <CookieBanner />
    </>
  )
}
