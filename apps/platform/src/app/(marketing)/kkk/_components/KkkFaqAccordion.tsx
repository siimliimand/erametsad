'use client'

import { SearchableAccordion, type SearchableItem } from '@erametsad/ui'
import { useEffect } from 'react'

/**
 * Wraps the ui SearchableAccordion so `#q-slug` deep links actually scroll.
 * The ui component expands the linked question but looks up an element id
 * the inner Accordion never renders (its ids are `accordion-button-*`), so
 * its built-in scrollIntoView is a no-op. Scroll the question button after
 * the expansion settles instead.
 */
export function KkkFaqAccordion({ items }: { items: SearchableItem[] }) {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith('#q-')) return
    const timer = window.setTimeout(() => {
      document
        .getElementById(`accordion-button-${hash.slice(1)}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 200)
    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  return <SearchableAccordion items={items} />
}
