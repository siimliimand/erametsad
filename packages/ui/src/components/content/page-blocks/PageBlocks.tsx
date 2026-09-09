import { resolveBlockConfig, testimonialItem } from './guards'

import type {
  PageBlockView,
  PageBlocksProps,
  TestimonialItemConfig,
} from './types'
import { BlockAccordion } from './BlockAccordion'
import { BlockCards } from './BlockCards'
import { BlockCta } from './BlockCta'
import { BlockFaq } from './BlockFaq'
import { BlockForm } from './BlockForm'
import { BlockHero } from './BlockHero'
import { BlockStats } from './BlockStats'
import { BlockTestimonials } from './BlockTestimonials'
import { BlockText } from './BlockText'
import { BlockTicker } from './BlockTicker'

/**
 * Renders an ordered page-block list, one registry type per view component.
 * No hooks and no data fetching: safe on the server (marketing pages) and in
 * client contexts (admin live preview). Unknown block types and configs that
 * fail the structural guards are skipped so a single bad row cannot break a
 * page render.
 */
export function PageBlocks({
  blocks,
  tickerLots = [],
  tickerOnRefresh,
  testimonials = [],
}: PageBlocksProps) {
  return (
    <>
      {blocks.map((view: PageBlockView) => {
        const resolved = resolveBlockConfig(view)
        if (resolved === null) return null
        switch (resolved.type) {
          case 'hero':
            return <BlockHero key={view.id} config={resolved.config} />
          case 'text':
            return <BlockText key={view.id} config={resolved.config} />
          case 'cards':
            return <BlockCards key={view.id} config={resolved.config} />
          case 'accordion':
            return <BlockAccordion key={view.id} id={view.id} config={resolved.config} />
          case 'form':
            return <BlockForm key={view.id} config={resolved.config} />
          case 'ticker':
            return (
              <BlockTicker
                key={view.id}
                config={resolved.config}
                lots={tickerLots}
                {...(tickerOnRefresh !== undefined ? { onRefresh: tickerOnRefresh } : {})}
              />
            )
          case 'stats':
            return <BlockStats key={view.id} config={resolved.config} />
          case 'cta':
            return <BlockCta key={view.id} config={resolved.config} />
          case 'testimonials':
            return (
              <BlockTestimonials
                key={view.id}
                config={resolved.config}
                items={testimonials.filter(
                  (item): item is TestimonialItemConfig =>
                    testimonialItem(item) !== null,
                )}
              />
            )
          case 'faq':
            return <BlockFaq key={view.id} id={view.id} config={resolved.config} />
        }
      })}
    </>
  )
}
