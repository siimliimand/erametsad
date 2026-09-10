'use client'

import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

export interface GalleryImage {
  src: string
  alt: string
}

const LIGHTBOX_BACKDROP = 'bg-[rgba(22,56,42,0.92)]'
const LIGHTBOX_BUTTON =
  'flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-[rgba(22,56,42,0.45)] text-white transition-colors duration-hover hover:bg-[rgba(22,56,42,0.75)]'

// Demo gallery anatomy (docs/design/demo/portal/02-lot-detail-open.html):
// thumbnails swap the main image, the main image opens a lightbox dialog with
// prev/next arrows, Escape closes and the arrow keys navigate.
export function Gallery({ images }: { images: GalleryImage[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const close = useCallback(() => {
    setLightboxIndex(null)
  }, [])
  const showPrev = useCallback(() => {
    setLightboxIndex((current) =>
      current === null ? null : (current - 1 + images.length) % images.length,
    )
  }, [images.length])
  const showNext = useCallback(() => {
    setLightboxIndex((current) =>
      current === null ? null : (current + 1) % images.length,
    )
  }, [images.length])

  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      if (event.key === 'ArrowLeft') showPrev()
      if (event.key === 'ArrowRight') showNext()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [lightboxIndex, close, showPrev, showNext])

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

  const bounded = Math.min(activeIndex, images.length - 1)
  const current = images[bounded] ?? first
  const lightboxImage =
    lightboxIndex === null ? null : (images[lightboxIndex] ?? null)

  return (
    <div>
      <button
        type="button"
        className="block w-full cursor-zoom-in overflow-hidden rounded-hero border border-border bg-bgMist shadow-card"
        onClick={() => {
          setLightboxIndex(bounded)
        }}
        aria-label="Ava pilt suurendatult"
      >
        <img
          src={current.src}
          alt={current.alt}
          className="aspect-[16/10] w-full object-cover"
        />
      </button>
      {images.length > 1 && (
        <div
          role="group"
          aria-label="Galerii pisipildid"
          className="mt-3 grid grid-cols-3 gap-3"
        >
          {images.map((image, index) => {
            const isActive = index === bounded
            return (
              <button
                key={image.src}
                type="button"
                className={`overflow-hidden rounded-button border-2 bg-bgMist transition-colors duration-hover ${
                  isActive
                    ? 'border-primary'
                    : 'border-border hover:border-primary'
                }`}
                onClick={() => {
                  setActiveIndex(index)
                }}
                aria-label={`Näita peapildil: ${image.alt}`}
                aria-current={isActive ? 'true' : undefined}
              >
                <img
                  src={image.src}
                  alt=""
                  className="aspect-[16/10] w-full object-cover"
                  loading="lazy"
                />
              </button>
            )
          })}
        </div>
      )}

      {lightboxImage !== null && lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Galerii suurendatult"
          className={`fixed inset-0 z-50 flex items-center justify-center p-6 md:p-12 ${LIGHTBOX_BACKDROP}`}
          onClick={close}
        >
          <button
            type="button"
            className={`absolute right-4 top-4 ${LIGHTBOX_BUTTON}`}
            aria-label="Sulge vaade"
            onClick={(event) => {
              event.stopPropagation()
              close()
            }}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          {images.length > 1 && (
            <button
              type="button"
              className={`absolute left-4 top-1/2 -translate-y-1/2 ${LIGHTBOX_BUTTON}`}
              aria-label="Eelmine pilt"
              onClick={(event) => {
                event.stopPropagation()
                showPrev()
              }}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <figure
            className="m-0 w-auto max-w-full"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              className="max-h-[78vh] w-auto max-w-full rounded-card object-contain shadow-modal"
            />
            <figcaption className="mt-3 text-center text-bodySm text-white">
              {lightboxImage.alt}
            </figcaption>
          </figure>
          {images.length > 1 && (
            <button
              type="button"
              className={`absolute right-4 top-1/2 -translate-y-1/2 ${LIGHTBOX_BUTTON}`}
              aria-label="Järgmine pilt"
              onClick={(event) => {
                event.stopPropagation()
                showNext()
              }}
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
