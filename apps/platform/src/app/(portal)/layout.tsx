import type { Metadata } from 'next'

import { AccountDeletionNotice } from './_components/AccountDeletionNotice'
import { ImpersonationBanner } from './_components/ImpersonationBanner'
import { PortalFooter } from './_components/PortalFooter'
import { PortalHeader } from './_components/PortalHeader'

import { getPortalAuthState } from '@/app/(portal)/_lib/session'

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
    <div className="flex min-h-screen flex-col bg-bgMist">
      <PortalHeader auth={auth} />
      <ImpersonationBanner auth={auth} />
      {auth ? <AccountDeletionNotice /> : null}
      <main className="mx-auto w-full max-w-container-xl flex-1 px-md py-lg md:px-lg">
        {children}
      </main>
      <PortalFooter />
    </div>
  )
}
