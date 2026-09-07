import { Testimonial } from '../Testimonial'

import type { TestimonialsBlockConfig } from './types'

export function BlockTestimonials({ config }: { config: TestimonialsBlockConfig }) {
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
        {config.items.map((item, index) => (
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
