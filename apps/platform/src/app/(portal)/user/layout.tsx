import type { Metadata } from 'next'

import { requirePortalSession } from '../_lib/session'
import { MyStreamProvider } from '../_lib/use-my-stream'
import { BottomTabBar } from './_components/BottomTabBar'
import { ShellHeader } from './_components/ShellHeader'
import { Sidebar } from './_components/Sidebar'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: {
    default: 'Minu keskkond',
    template: '%s – Minu keskkond',
  },
}

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requirePortalSession()

  // Mirrors profileDisplayName in ../_lib/session.ts; only a serializable
  // name crosses into the client Shell.
  const profileName =
    profile?.type === 'company'
      ? profile.companyName ?? profile.displayName ?? null
      : profile?.displayName ?? profile?.companyName ?? null

  return (
    <MyStreamProvider>
      <ShellHeader profileName={profileName} />
      <div className="mt-md flex items-start gap-md pb-3xl md:pb-md">
        <Sidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <BottomTabBar />
    </MyStreamProvider>
  )
}
