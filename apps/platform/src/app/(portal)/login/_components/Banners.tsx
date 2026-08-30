'use client'

interface BannerLayoutProps {
  severity: 'alert' | 'info'
  title: string
  children: React.ReactNode
}

function BannerLayout({ severity, title, children }: BannerLayoutProps) {
  const tone =
    severity === 'alert'
      ? 'border-danger bg-dangerLight'
      : 'border-info bg-infoLight'
  return (
    <div
      role={severity === 'alert' ? 'alert' : 'status'}
      className={`rounded-card border p-md ${tone}`}
    >
      <p
        className={`font-label font-semibold uppercase tracking-wide ${
          severity === 'alert' ? 'text-danger' : 'text-info'
        }`}
      >
        {title}
      </p>
      <div className="mt-2xs font-body text-body text-ink">{children}</div>
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
          href="mailto:info@eametsad.ee"
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          info@eametsad.ee
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
