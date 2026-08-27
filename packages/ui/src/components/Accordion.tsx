'use client'

import { type ReactNode, useState, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'

interface AccordionItem {
  id: string
  title: string
  content: ReactNode
}

interface AccordionProps {
  variant: 'single' | 'multi'
  items: AccordionItem[]
  className?: string
}

export function Accordion({ variant, items, className }: AccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  const toggle = useCallback(
    (id: string) => {
      setOpenIds((prev) => {
        if (variant === 'single') {
          return prev.has(id) ? new Set() : new Set([id])
        }
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    },
    [variant],
  )

  return (
    <div className={className}>
      {items.map((item) => {
        const isOpen = openIds.has(item.id)
        const panelId = `accordion-panel-${item.id}`
        const buttonId = `accordion-button-${item.id}`

        return (
          <div key={item.id}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggle(item.id)
                  }
                }}
                className="flex w-full items-center justify-between px-4 py-3 text-left font-medium"
              >
                {item.title}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={`overflow-hidden transition-[max-height] duration-200 ${
                isOpen ? 'max-h-[999px]' : 'max-h-0'
              }`}
            >
              <div className="px-4 pb-3">{item.content}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}