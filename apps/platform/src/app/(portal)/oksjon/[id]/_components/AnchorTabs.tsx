'use client'

import { useEffect, useMemo, useState } from 'react'

export interface AnchorTabItem {
  id: string
  label: string
}

// Demo anchor tab row (docs/design/demo/portal/02-lot-detail-open.html .tabs):
// pill buttons that smooth-scroll to their section; an IntersectionObserver
// tracks which section is in view and marks the tab active.
export function AnchorTabs({ items }: { items: AnchorTabItem[] }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '')
  const itemKey = useMemo(() => items.map((item) => item.id).join('|'), [items])

  useEffect(() => {
    const sections = items
      .map((item) => {
        const el = document.getElementById(item.id)
        return el !== null ? { id: item.id, el } : null
      })
      .filter((entry): entry is { id: string; el: HTMLElement } => entry !== null)
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        }
      },
      // A section counts as active once it enters the upper-middle band of
      // the viewport, which keeps exactly one tab marked while scrolling.
      { rootMargin: '-25% 0px -65% 0px' },
    )
    sections.forEach((section) => {
      observer.observe(section.el)
    })
    return () => {
      observer.disconnect()
    }
  }, [items, itemKey])

  return (
    <nav aria-label="Lehe osad">
      <div className="flex gap-2 overflow-x-auto py-4 [scrollbar-width:thin]">
        {items.map((item) => {
          const isActive = item.id === activeId
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'true' : undefined}
              className={`inline-flex flex-none items-center rounded-pill border px-4 py-[9px] text-bodySm font-semibold transition-colors duration-hover ${
                isActive
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-bgPage text-ink hover:border-primary hover:text-primary'
              }`}
              onClick={() => {
                setActiveId(item.id)
                const target = document.getElementById(item.id)
                if (target !== null) {
                  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
