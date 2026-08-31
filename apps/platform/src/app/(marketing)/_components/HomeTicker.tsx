'use client';

import { AuctionTicker, type LotCardProps } from '@eametsad/ui';
import { useCallback, useState } from 'react';

import { PORTAL_HOSTNAME } from '@/lib/routing/host-areas';

/**
 * Serializable subset of the auction list summary (listAuctions and
 * GET /api/v1/auctions share this shape). Kept structural so the server
 * page and the 60s client refresh feed the same mapping.
 */
export interface TickerLotSummary {
  id: string;
  title: string;
  objectType: string;
  registryNumber: string | null;
  county: { name: string } | null;
  parish: { name: string } | null;
  minBid: number;
  area: number | null;
  volume: number | null;
  species: string[];
  endsAt: string;
  image: string | null;
}

const OBJECT_TYPE_LABELS: Record<'raieoigus' | 'kinnistu' | 'kiire' | 'pakett', string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Metskinnistu',
  kiire: 'Kiiroksjon',
  pakett: 'Pakett',
};

// LotCard requires an image; lots without media get a quiet placeholder.
const FALLBACK_LOT_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100'%3E%3Crect width='160' height='100' fill='%23e7efe9'/%3E%3C/svg%3E";

function typeLabelOf(objectType: string): string | undefined {
  return OBJECT_TYPE_LABELS[objectType as keyof typeof OBJECT_TYPE_LABELS];
}

function toTickerLotProps(summary: TickerLotSummary): LotCardProps {
  const title = summary.registryNumber ?? summary.title;
  const typeLabel = typeLabelOf(summary.objectType);
  return {
    image: { src: summary.image ?? FALLBACK_LOT_IMAGE, alt: title },
    title,
    alghind: summary.minBid,
    county: summary.county?.name ?? '',
    area: summary.area ?? 0,
    endsAt: summary.endsAt,
    status: 'active',
    href: `https://${PORTAL_HOSTNAME}/oksjon/${summary.id}`,
    ctaLabel: 'Vaata oksjonit',
    ...(typeLabel !== undefined ? { typeLabel } : {}),
    ...(summary.parish ? { parish: summary.parish.name } : {}),
    ...(summary.volume !== null ? { volumeM3: summary.volume } : {}),
    ...(summary.species.length > 0 ? { speciesNames: summary.species } : {}),
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableLocation(value: unknown): value is { name: string } | null {
  if (value === null) return true;
  if (typeof value !== 'object') return false;
  return typeof (value as { name?: unknown }).name === 'string';
}

function isTickerLotSummary(value: unknown): value is TickerLotSummary {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    typeof record.objectType === 'string' &&
    isNullableString(record.registryNumber) &&
    isNullableLocation(record.county) &&
    isNullableLocation(record.parish) &&
    typeof record.minBid === 'number' &&
    (record.area === null || typeof record.area === 'number') &&
    (record.volume === null || typeof record.volume === 'number') &&
    typeof record.endsAt === 'string' &&
    isNullableString(record.image) &&
    Array.isArray(record.species) &&
    record.species.every((entry) => typeof entry === 'string')
  );
}

export function HomeTicker({ initialLots }: { initialLots: TickerLotSummary[] }) {
  const [lots, setLots] = useState<LotCardProps[]>(() =>
    initialLots.map(toTickerLotProps),
  );

  // AuctionTicker schedules this every 60s; transient failures keep the
  // current cards on screen instead of flashing the empty state.
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        '/api/v1/auctions?auctionStatus=active&sort=endTime&order=asc&limit=4',
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const payload: unknown = await res.json();
      if (typeof payload !== 'object' || payload === null) return;
      const auctions = (payload as { auctions?: unknown }).auctions;
      if (!Array.isArray(auctions)) return;
      setLots(auctions.filter(isTickerLotSummary).map(toTickerLotProps));
    } catch {
      // Keep the server-rendered cards.
    }
  }, []);

  // Stable identity: AuctionTicker re-runs its 60s interval effect whenever
  // the callback changes, so an inline arrow would restart the timer after
  // every refresh.
  const onRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  // Spec (marketing-home): exact info card replaces the ticker.
  if (lots.length === 0) {
    return (
      <div className="rounded-card border border-border bg-bgMist px-md py-xl text-center">
        <p className="font-heading text-h3 text-ink">Hetkel pole avatud oksjoneid</p>
        <p className="mt-xs text-body text-inkMuted">
          Uuest oksjonist anname teada portaali teavitustena.
        </p>
        <a
          href={`https://${PORTAL_HOSTNAME}/user/notifications`}
          className="mt-md inline-flex h-12 items-center justify-center rounded-button border border-primary px-6 font-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primary-light"
        >
          Vaata portaali teavitusi
        </a>
      </div>
    );
  }

  return <AuctionTicker lots={lots} onRefresh={onRefresh} />;
}
