import { AuctionTicker } from '../AuctionTicker'

import type { TickerBlockConfig } from './types'
import type { LotCardProps } from '../LotCard'

export function BlockTicker({
  config,
  lots,
  onRefresh,
}: {
  config: TickerBlockConfig
  lots: readonly LotCardProps[]
  onRefresh?: () => void
}) {
  const limit = config.limit ?? 4
  const refreshSeconds = config.autoRefreshSeconds ?? 0
  const filtered =
    config.objectType === undefined
      ? lots
      : lots.filter((lot) => lot.objectType === config.objectType)
  return (
    <section className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
      <div className="flex flex-wrap items-baseline justify-between gap-md">
        {config.heading !== undefined && (
          <h2 className="font-heading text-h2 text-ink">{config.heading}</h2>
        )}
        {config.linkLabel !== undefined && config.linkHref !== undefined && (
          <a
            href={config.linkHref}
            className="font-semibold text-primary underline transition-colors duration-hover ease-hover hover:text-primaryHover"
          >
            {config.linkLabel}
          </a>
        )}
      </div>
      <div className={config.heading !== undefined ? 'mt-md' : ''}>
        <AuctionTicker
          lots={filtered.slice(0, limit)}
          {...(onRefresh !== undefined && refreshSeconds > 0
            ? { onRefresh, refreshMs: refreshSeconds * 1000 }
            : {})}
        />
      </div>
    </section>
  )
}
