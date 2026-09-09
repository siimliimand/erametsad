import { LeadForm } from '../../form/LeadForm'

import type { FormBlockConfig } from './types'

/** Paigutus variants: card panel (default) or plain light background. */
function panelClass(paigutus: string | undefined): string {
  return paigutus === 'heledal'
    ? 'max-w-container-sm rounded-card border border-border bg-bgPage p-lg'
    : 'max-w-container-sm rounded-card bg-bgMist p-lg'
}

export function BlockForm({ config }: { config: FormBlockConfig }) {
  return (
    <section
      className="mx-auto max-w-container-xl px-md py-xl md:px-lg"
      data-form-type={config.type}
    >
      <div className={panelClass(config.paigutus)}>
        {config.heading !== undefined && (
          <h2 className="font-heading text-h3 text-ink">{config.heading}</h2>
        )}
        {config.description !== undefined && (
          <p
            className={`text-body text-inkMuted ${
              config.heading !== undefined ? 'mt-xs' : ''
            }`}
          >
            {config.description}
          </p>
        )}
        <div className="mt-md">
          <LeadForm slug={config.slug} />
        </div>
      </div>
    </section>
  )
}
