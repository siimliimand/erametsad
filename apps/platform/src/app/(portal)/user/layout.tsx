import type { Metadata } from 'next'

import { requirePortalSession } from '../_lib/session'
import { MyStreamProvider } from '../_lib/use-my-stream'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: {
    default: 'Minu keskkond',
    template: '%s – Minu keskkond',
  },
}

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Session guard: every /user/* route stays behind the portal login. The
  // demo-styled header with the user menu comes from the (portal) layout now
  // (design D9), so the removed user shell no longer renders here.
  await requirePortalSession()

  // MyStreamProvider keeps the user area's own live features working (bid
  // card updates, notification inbox toasts). The portal header's unread
  // badge sits above this provider and polls GET /api/v1/my/notifications on
  // mount; it cannot subscribe to this stream, so header badge increments
  // stay poll-based until the provider moves portal-wide.
  return <MyStreamProvider>{children}</MyStreamProvider>
}
