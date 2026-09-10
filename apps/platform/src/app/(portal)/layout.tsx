import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'

import './portal.css'

import { AccountDeletionNotice } from './_components/AccountDeletionNotice'
import { CookieBanner } from './_components/CookieBanner'
import { ImpersonationBanner } from './_components/ImpersonationBanner'
import { PortalFooter } from './_components/PortalFooter'
import { PortalHeader } from './_components/PortalHeader'

import { getPortalAuthState } from '@/app/(portal)/_lib/session'

// Demo design language (portal-demo-design-parity D2): portal headings render
// in Manrope 700/800 while the root layout keeps Public Sans for marketing and
// admin. next/font self-hosts the files, so the CSP gains no font hosts.
const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  weight: ['700', '800'],
  variable: '--font-manrope',
})

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: {
    default: 'Oksjonid',
    template: '%s – Erametsad oksjonid',
  },
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const auth = await getPortalAuthState()

  return (
    <div className={`portal-scope ${manrope.variable} flex min-h-screen flex-col bg-bgMist`}>
      <PortalHeader auth={auth} />
      <ImpersonationBanner auth={auth} />
      {auth ? <AccountDeletionNotice /> : null}
      <main className="mx-auto w-full max-w-container-xl flex-1 px-md py-lg md:px-lg">
        {children}
      </main>
      <PortalFooter />
      <CookieBanner />
    </div>
  )
}
