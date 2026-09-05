'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function FeeChangeBannerInner() {
  const searchParams = useSearchParams()
  if (searchParams.get('ok') !== 'tasud') {
    return null
  }
  return (
    <div
      role="status"
      className="mb-md rounded-input border border-primary bg-primary-light px-md py-sm text-bodySm text-ink"
    >
      Tasu muudatus on salvestatud. Kehtib ainult uutele oksjonidele — käimasolevate
      oksjonide tasud jäävad muutmata.
    </div>
  )
}

/** Shown after a Tasud save that changed a fee value (spec: applies to new auctions only). */
export function FeeChangeBanner() {
  return (
    <Suspense fallback={null}>
      <FeeChangeBannerInner />
    </Suspense>
  )
}
