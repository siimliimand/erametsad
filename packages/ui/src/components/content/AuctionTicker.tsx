'use client'

import { useEffect } from 'react'
import { Card } from '../Card'
import { LotCard, type LotCardProps } from './LotCard'
import { EmptyState } from '../EmptyState'

export interface AuctionTickerProps {
  lots: LotCardProps[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onRefresh?: () => void
}

export function AuctionTicker({
  lots,
  isLoading = false,
  error = null,
  onRetry,
  onRefresh,
}: AuctionTickerProps) {
  useEffect(() => {
    if (!onRefresh) return
    const id = setInterval(onRefresh, 60_000)
    return () => clearInterval(id)
  }, [onRefresh])

  if (error) {
    return (
      <EmptyState
        title="Viga oksjonite laadimisel"
        description={error}
        action={
          onRetry ? (
            <button
              onClick={onRetry}
              className="rounded-lg bg-accent px-4 py-2 text-white transition-opacity hover:opacity-90"
            >
              Proovi uuesti
            </button>
          ) : undefined
        }
      />
    )
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} hover={false}>
            <div className="animate-pulse space-y-3 p-6">
              <div className="aspect-[16/10] rounded-card bg-bg-mist" />
              <div className="h-4 w-3/4 rounded bg-bg-mist" />
              <div className="h-3 w-1/2 rounded bg-bg-mist" />
              <div className="h-4 w-1/3 rounded bg-bg-mist" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (lots.length === 0) {
    return (
      <EmptyState title="Hetkel aktiivseid oksjoneid pole" />
    )
  }

  const cardWidth = 'min-w-[280px] lg:min-w-0 lg:w-full'

  return (
    <div className="relative">
      <div
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory
          scrollbar-none lg:scrollbar-default
          pb-2 -mb-2"
      >
        {lots.map((lot, i) => (
          <div
            key={i}
            className={`snap-start shrink-0 ${cardWidth} ${lots.length <= 4 ? 'lg:flex-1' : ''}`}
          >
            <LotCard {...lot} />
          </div>
        ))}
      </div>
      {lots.length > 4 && (
        <div className="mt-4 flex justify-center gap-1.5 lg:hidden">
          {lots.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-accent' : 'bg-bg-mist'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}