import type { CtaBlockConfig } from './types'

const buttonGreenClass =
  'inline-flex h-12 shrink-0 items-center justify-center rounded-button bg-cta px-6 font-label font-semibold text-ink transition-all duration-hover ease-hover hover:bg-cta-hover motion-reduce:transition-none'
const buttonAmberClass =
  'inline-flex h-12 shrink-0 items-center justify-center rounded-button bg-primary px-6 font-label font-semibold text-inkInverse transition-all duration-hover ease-hover hover:bg-primaryDark motion-reduce:transition-none'

export function BlockCta({ config }: { config: CtaBlockConfig }) {
  const amber = config.style === 'amber'
  return (
    <section className={amber ? 'bg-cta' : 'bg-primary'}>
      <div className="mx-auto flex max-w-container-xl flex-col gap-md px-md py-lg md:flex-row md:items-center md:justify-between md:px-lg">
        <div>
          <h2
            className={`max-w-container-sm font-heading text-h3 ${
              amber ? 'text-ink' : 'text-inkInverse'
            }`}
          >
            {config.heading}
          </h2>
          {config.body !== undefined && (
            <p
              className={`mt-xs max-w-container-sm text-body ${
                amber ? 'text-ink/80' : 'text-white/90'
              }`}
            >
              {config.body}
            </p>
          )}
        </div>
        <a href={config.cta.href} className={amber ? buttonAmberClass : buttonGreenClass}>
          {config.cta.label}
        </a>
      </div>
    </section>
  )
}
