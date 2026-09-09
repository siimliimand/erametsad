import type { CSSProperties } from 'react'

import type { HeroBlockConfig } from './types'

const primaryCtaClass =
  'inline-flex h-12 items-center justify-center gap-2 rounded-button bg-cta px-6 font-label font-semibold text-ink transition-all duration-hover ease-hover hover:bg-cta-hover motion-reduce:transition-none'
const secondaryCtaClass =
  'inline-flex h-12 items-center justify-center gap-2 rounded-button border border-white/70 px-6 font-label font-semibold text-white transition-colors duration-hover hover:bg-white/10'

const OVERLAY_RGB = '22, 56, 42'

/**
 * Overlay strength (0–80) scales the green gradient: the leading edge uses
 * the strength as its alpha, the trailing edge keeps 55% of it so the
 * default (80) stays close to the original fixed gradient.
 */
function overlayStyle(overlayStrength: number | undefined): CSSProperties {
  const alpha = (overlayStrength ?? 80) / 100
  return {
    backgroundImage:
      'linear-gradient(90deg, rgba(' +
      OVERLAY_RGB +
      ', ' +
      alpha.toFixed(2) +
      '), rgba(' +
      OVERLAY_RGB +
      ', ' +
      (alpha * 0.55).toFixed(2) +
      '))',
  }
}

export function BlockHero({ config }: { config: HeroBlockConfig }) {
  return (
    <section style={overlayStyle(config.overlayStrength)}>
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
