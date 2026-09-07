'use client'

import { useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'

export interface TabBarItem {
  id: string
  label: ReactNode
  count?: number
}

export interface TabBarProps {
  items: readonly TabBarItem[]
  value: string
  onChange: (id: string) => void
  'aria-label': string
}

// Pill tabs with count badges (02-auctions-list demo .tabs/.tab/.tab-count).
// Roving tabindex: the active tab is the only tab stop; arrows, Home and End
// move both focus and selection.
export function TabBar({ items, value, onChange, 'aria-label': ariaLabel }: TabBarProps) {
  const listRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const ids = items.map((item) => item.id)
    const currentIndex = Math.max(0, ids.indexOf(value))
    let nextIndex: number
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % ids.length
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + ids.length) % ids.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = ids.length - 1
    else return
    event.preventDefault()
    const nextId = ids[nextIndex]
    if (nextId === undefined) return
    onChange(nextId)
    listRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [nextIndex]?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className="flex flex-wrap gap-2"
    >
      {items.map((item) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(item.id)
            }}
            className={`inline-flex items-center gap-2 rounded-pill border py-1.5 pl-3.5 pr-2 text-bodySm transition-colors duration-hover ease-hover ${
              selected
                ? 'border-primary bg-primary font-semibold text-inkInverse'
                : 'border-border bg-bgPage font-medium text-ink hover:border-primary hover:text-primary'
            }`}
          >
            {item.label}
            {item.count === undefined ? null : (
              <span
                className={`rounded-pill px-2 py-px font-mono text-[11px] font-medium leading-4 ${
                  selected ? 'bg-white/[0.18] text-inkInverse' : 'bg-bgMist text-inkMuted'
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
