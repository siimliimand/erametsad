import { Accordion } from '../../Accordion'

import type { FaqBlockConfig } from './types'

export function BlockFaq({ config, id }: { config: FaqBlockConfig; id: string }) {
  return (
    <section className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
      <div className="max-w-container-sm">
        {config.heading !== undefined && (
          <h2 className="font-heading text-h2 text-ink">{config.heading}</h2>
        )}
        <Accordion
          variant="single"
          className={`rounded-card border border-border bg-bgPage shadow-card ${
            config.heading !== undefined ? 'mt-md' : ''
          }`}
          items={config.items.map((item, index) => ({
            id: `${id}-${index}`,
            title: item.question,
            content: <p className="text-body text-inkMuted">{item.answer}</p>,
          }))}
        />
      </div>
    </section>
  )
}
