'use client'

import { useRef } from 'react'

export type SharedMediaCarouselItem = {
  id: string
  fileName: string | null
  mimeType: string | null
  mediaType: 'image' | 'video'
  signedUrl: string | null
}

type SharedMediaCarouselProps = {
  items: SharedMediaCarouselItem[]
}

const ATTACHMENT_LABEL = '\uCCA8\uBD80 \uBBF8\uB514\uC5B4'
const UNAVAILABLE_LABEL = '\uBBF8\uB514\uC5B4\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4'

export function SharedMediaCarousel({ items }: SharedMediaCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const scrollMedia = (direction: -1 | 1) => {
    const scroller = scrollerRef.current

    if (!scroller) return

    scroller.scrollBy({
      left: direction * Math.max(240, scroller.clientWidth * 0.75),
      behavior: 'smooth',
    })
  }

  if (items.length === 0) return null

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--color-text-muted)]">
          {ATTACHMENT_LABEL}
        </p>
        {items.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollMedia(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-sm font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
              aria-label="previous media"
            >
              &lt;
            </button>
            <button
              type="button"
              onClick={() => scrollMedia(1)}
              className="flex h-7 w-7 items-center justify-center rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-sm font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
              aria-label="next media"
            >
              &gt;
            </button>
          </div>
        )}
      </div>
      <div ref={scrollerRef} className="flex gap-3 overflow-x-auto scroll-smooth pb-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex h-[240px] flex-none items-center justify-center overflow-hidden rounded-[8px] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] md:h-[320px]"
          >
            {item.signedUrl && item.mediaType === 'image' ? (
              <img
                src={item.signedUrl}
                alt={ATTACHMENT_LABEL}
                className="h-full w-auto max-w-none object-contain"
              />
            ) : item.signedUrl ? (
              <video
                src={item.signedUrl}
                controls
                preload="metadata"
                className="h-full w-auto max-w-none object-contain"
              />
            ) : (
              <div className="flex h-full w-60 items-center justify-center px-4 text-center text-xs text-[var(--color-text-muted)]">
                {UNAVAILABLE_LABEL}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
