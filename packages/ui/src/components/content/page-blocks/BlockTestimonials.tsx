import { Testimonial } from '../Testimonial'

import type { TestimonialItemConfig, TestimonialsBlockConfig } from './types'

/**
 * Renders items from the published `testimonials` collection (passed by the
 * caller, sliced to the block limit). Renders nothing when the collection
 * has no items, so live-data blocks never show placeholder copy on the
 * marketing site.
 */
export function BlockTestimonials({
  config,
  items,
}: {
  config: TestimonialsBlockConfig
  items: readonly TestimonialItemConfig[]
}) {
  if (items.length === 0) return null
  const limit = config.limit ?? 6
  const visible = items.slice(0, limit)
  return (
    <section className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
      {config.heading !== undefined && (
        <h2 className="font-heading text-h2 text-ink">{config.heading}</h2>
      )}
      <ul
        className={`grid gap-lg md:grid-cols-2 lg:grid-cols-3 ${
          config.heading !== undefined ? 'mt-md' : ''
        }`}
      >
        {visible.map((item, index) => (
          <li key={[item.author, index].join('-')}>
            <Testimonial
              quote={item.quote}
              author={item.author}
              {...(item.role !== undefined ? { role: item.role } : {})}
              {...(item.image !== undefined ? { image: item.image } : {})}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
