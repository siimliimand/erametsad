'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

export interface ScrollableTabNavProps {
  ariaLabel: string
  activeKey?: string
  className?: string
  children: ReactNode
}

export function ScrollableTabNav({
  ariaLabel,
  activeKey,
  className = '',
  children,
}: ScrollableTabNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    // 2px threshold avoids subpixel rounding jitter
    setCanScrollLeft(scrollLeft > 2)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollState()

    const handleResize = () => {
      updateScrollState()
    }
    window.addEventListener('resize', handleResize)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        updateScrollState()
      })
      observer.observe(el)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      if (observer) {
        observer.disconnect()
      }
    }
  }, [updateScrollState])

  // Scroll active tab into view when activeKey changes
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const activeEl = container.querySelector<HTMLElement>(
      '[aria-current="page"], [aria-current="true"]'
    )
    if (!activeEl) return

    const containerRect = container.getBoundingClientRect()
    const activeRect = activeEl.getBoundingClientRect()

    // Only scroll if container is actually rendered with dimensions
    if (containerRect.width === 0) return

    // Keep a 16px buffer from edge when scrolling into view
    if (activeRect.left < containerRect.left) {
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({
          left: Math.max(0, container.scrollLeft + (activeRect.left - containerRect.left) - 16),
          behavior: 'smooth',
        })
      }
    } else if (activeRect.right > containerRect.right) {
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({
          left: container.scrollLeft + (activeRect.right - containerRect.right) + 16,
          behavior: 'smooth',
        })
      }
    }
  }, [activeKey])

  return (
    <div className={`relative ${className}`}>
      {/* Left fade indicator */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-6 sm:w-8 bg-gradient-to-r from-white to-transparent transition-opacity duration-200 ${
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Scrollable track */}
      <nav aria-label={ariaLabel}>
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-2 overflow-x-auto py-3 md:py-4 overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {children}
        </div>
      </nav>

      {/* Right fade indicator */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-6 sm:w-8 bg-gradient-to-l from-white to-transparent transition-opacity duration-200 ${
          canScrollRight ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
