import Link from 'next/link'

const legalLinks = [
  { label: 'Tingimused', href: '/tingimused' },
  { label: 'Privaatsuspoliitika', href: '/privaatsuspoliitika' },
]

export function PortalFooter() {
  return (
    <footer className="bg-primaryDark text-ink-inverse">
      <div className="mx-auto flex w-full max-w-container-xl flex-col gap-md px-md py-lg md:flex-row md:items-center md:justify-between md:px-lg">
        <div>
          <p className="font-heading text-h4 font-extrabold">Eametsad</p>
          <p className="text-label text-ink-inverse opacity-70">Eesti metsatehingute platvorm</p>
        </div>
        <div className="text-bodySm">
          <p className="font-semibold">Abi ja küsimused</p>
          <a
            href="mailto:info@eametsad.ee"
            className="opacity-80 transition-opacity duration-hover hover:opacity-100"
          >
            info@eametsad.ee
          </a>
        </div>
        <nav aria-label="Juriidiline teave" className="flex gap-md text-bodySm">
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="opacity-80 transition-opacity duration-hover hover:opacity-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto w-full max-w-container-xl px-md py-sm text-label text-ink-inverse opacity-60 md:px-lg">
          © {new Date().getFullYear()} Eametsad
        </p>
      </div>
    </footer>
  )
}
