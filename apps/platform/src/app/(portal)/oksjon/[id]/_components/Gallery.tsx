'use client'

import { useCallback, useEffect, useState } from 'react'

export interface GalleryImage {
  src: string
  alt: string
}

export function Gallery({ images }: { images: GalleryImage[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const close = useCallback(() => {
    setOpenIndex(null)
  }, [])
  const showPrev = useCallback(() => {
    setOpenIndex((current) =>
      current === null ? null : (current - 1 + images.length) % images.length,
    )
  }, [images.length])
  const showNext = useCallback(() => {
    setOpenIndex((current) => (current === null ? null : (current + 1) % images.length))
  }, [images.length])

  useEffect(() => {
    if (openIndex === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      if (event.key === 'ArrowLeft') showPrev()
      if (event.key === 'ArrowRight') showNext()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [openIndex, close, showPrev, showNext])

  const first = images[0] ?? null
  if (first === null) {
    return (
      <div
        className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-xs rounded-card border border-border bg-bgMist text-inkMuted"
        aria-label="Fotod puuduvad"
      >
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="M4 17l5-5 4 4 3-3 4 4" />
        </svg>
        <span className="text-bodySm">Fotod puuduvad</span>
      </div>
    )
  }

  const activeIndex = openIndex
  const active = activeIndex === null ? null : (images[activeIndex] ?? null)

  return (
    <div>
      <button
        type="button"
        className="block w-full cursor-zoom-in overflow-hidden rounded-card border border-border"
        onClick={() => {
          setOpenIndex(0)
        }}
        aria-label="Ava pildigalerii"
      >
        <img
          src={first.src}
          alt={first.alt}
          className="aspect-[16/10] w-full object-cover"
        />
      </button>
      {images.length > 1 && (
        <div className="mt-xs flex gap-xs overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.src}
              type="button"
              className="h-20 w-32 shrink-0 cursor-zoom-in overflow-hidden rounded-button border border-border"
              onClick={() => {
                setOpenIndex(index)
              }}
              aria-label={`Ava pilt ${String(index + 1)}`}
            >
              <img src={image.src} alt={image.alt} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {active !== null && activeIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.alt}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-md"
          onClick={close}
        >
          <div
            className="relative flex max-h-full w-full max-w-4xl flex-col items-center gap-sm"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <img
              src={active.src}
              alt={active.alt}
              className="max-h-[80vh] w-auto rounded-card object-contain"
            />
            <div className="flex items-center gap-sm">
              {images.length > 1 && (
                <button
                  type="button"
                  className="rounded-button bg-bgPage px-sm py-2xs text-bodySm font-semibold text-ink"
                  onClick={showPrev}
                >
                  ‹ Eelmine
                </button>
              )}
              <span className="text-bodySm text-bgPage">
                {`${String(activeIndex + 1)} / ${String(images.length)}`}
              </span>
              {images.length > 1 && (
                <button
                  type="button"
                  className="rounded-button bg-bgPage px-sm py-2xs text-bodySm font-semibold text-ink"
                  onClick={showNext}
                >
                  Järgmine ›
                </button>
              )}
              <button
                type="button"
                className="ml-auto rounded-button bg-bgPage px-sm py-2xs text-bodySm font-semibold text-ink"
                onClick={close}
              >
                Sulge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
