import { Accordion } from '../../Accordion'

import type { AccordionBlockConfig } from './types'

export function BlockAccordion({
  config,
  id,
}: {
  config: AccordionBlockConfig
  id: string
}) {
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
          defaultOpenIds={config.items.flatMap((item, index) =>
            item.defaultOpen === true ? [`${id}-${String(index)}`] : [],
          )}
          items={config.items.map((item, index) => ({
            id: `${id}-${index}`,
            title: item.title,
            content: <p className="text-body text-inkMuted">{item.content}</p>,
          }))}
        />
      </div>
    </section>
  )
}
