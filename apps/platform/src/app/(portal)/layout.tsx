import type { Metadata } from 'next'

import { PortalFooter } from './_components/PortalFooter'
import { PortalHeader } from './_components/PortalHeader'

import { getPortalAuthState } from '@/app/(portal)/_lib/session'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: {
    default: 'Oksjonid',
    template: '%s – Eametsad oksjonid',
  },
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const auth = await getPortalAuthState()

  return (
    <div className="flex min-h-screen flex-col bg-bgMist">
      <PortalHeader auth={auth} />
      <main className="mx-auto w-full max-w-container-xl flex-1 px-md py-lg md:px-lg">
        {children}
      </main>
      <PortalFooter />
    </div>
  )
}
