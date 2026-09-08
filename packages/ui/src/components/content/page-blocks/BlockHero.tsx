import type { HeroBlockConfig } from './types'

const primaryCtaClass =
  'inline-flex h-12 items-center justify-center gap-2 rounded-button bg-cta px-6 font-label font-semibold text-ink transition-all duration-hover ease-hover hover:bg-cta-hover motion-reduce:transition-none'
const secondaryCtaClass =
  'inline-flex h-12 items-center justify-center gap-2 rounded-button border border-white/70 px-6 font-label font-semibold text-white transition-colors duration-hover hover:bg-white/10'

export function BlockHero({ config }: { config: HeroBlockConfig }) {
  return (
    <section className="bg-[linear-gradient(90deg,rgba(22,56,42,0.92),rgba(22,56,42,0.55))]">
      <div className="mx-auto grid max-w-container-xl gap-lg px-md py-xl md:px-lg lg:grid-cols-2 lg:items-center">
        <div>
          {config.kicker !== undefined && (
            <p className="font-label text-label uppercase tracking-wide text-white/80">
              {config.kicker}
            </p>
          )}
          <h1 className="font-heading text-h1 text-inkInverse">{config.heading}</h1>
          {config.body !== undefined && (
            <p className="mt-md max-w-container-sm text-body text-white/90">
              {config.body}
            </p>
          )}
          <div className="mt-lg flex flex-col gap-xs sm:flex-row">
            <a href={config.primaryCta.href} className={primaryCtaClass}>
              {config.primaryCta.label}
            </a>
            {config.secondaryCta !== undefined && (
              <a href={config.secondaryCta.href} className={secondaryCtaClass}>
                {config.secondaryCta.label}
              </a>
            )}
          </div>
        </div>
        {config.image !== undefined && (
          <img
            src={config.image}
            alt=""
            className="hidden rounded-card object-cover lg:block aspect-[4/3] w-full"
          />
        )}
      </div>
    </section>
  )
}
