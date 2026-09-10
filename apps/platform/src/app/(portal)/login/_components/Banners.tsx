'use client'

import { CircleAlert, ShieldAlert } from 'lucide-react'

interface BannerLayoutProps {
  severity: 'alert' | 'info'
  title: string
  children: React.ReactNode
}

function BannerLayout({ severity, title, children }: BannerLayoutProps) {
  const isAlert = severity === 'alert'
  const Icon = isAlert ? ShieldAlert : CircleAlert
  const tone = isAlert ? 'border-danger bg-dangerLight' : 'border-info bg-infoLight'
  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      className={`flex items-start gap-sm rounded-card border p-md ${tone}`}
    >
      <Icon
        className={`mt-0.5 h-5 w-5 shrink-0 ${isAlert ? 'text-danger' : 'text-info'}`}
        aria-hidden="true"
      />
      <div>
        <p className={`font-heading text-body font-bold ${isAlert ? 'text-danger' : 'text-info'}`}>
          {title}
        </p>
        <div className="mt-2xs font-body text-bodySm text-ink">{children}</div>
      </div>
    </div>
  )
}

// Rendered only when the backend explicitly signals account suspension
// (suspended: true / code: ACCOUNT_SUSPENDED); today's endpoints answer with
// a generic 401 instead.
export function SuspendedBanner() {
  return (
    <BannerLayout severity="alert" title="Sinu konto on peatatud">
      <p>
        Portaali sisenemine on peatatud konto korral keelatud. Küsimuste korral võta
        ühendust aadressil{' '}
        <a
          href="mailto:info@erametsad.ee"
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          info@erametsad.ee
        </a>
        .
      </p>
    </BannerLayout>
  )
}

export function PendingCompanyBanner() {
  return (
    <BannerLayout severity="info" title="Ettevõtte juurdepääsutaotlus on menetluses">
      <p>
        Sinu taotlus ettevõtte profiilile juurdepääsuks on administraatoril menetluses.
        Saad teavituse, kui taotlus on läbi vaadatud.
      </p>
    </BannerLayout>
  )
}
