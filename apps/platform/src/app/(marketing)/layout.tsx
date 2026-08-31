import type { Metadata } from 'next'

import { MARKETING_BASE_URL } from './_lib/base-url'

export const metadata: Metadata = {
  metadataBase: new URL(MARKETING_BASE_URL),
  title: {
    default: 'Eametsad',
    template: '%s | Eametsad',
  },
  description: 'Eesti metsatehingute platvorm',
}

// Header and footer arrive with tasks 2.2-2.3; ContactBand and
// CookieBanner mount here in task 2.4.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
