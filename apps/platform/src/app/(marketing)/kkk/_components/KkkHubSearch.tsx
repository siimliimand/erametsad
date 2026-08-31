'use client'

import { Search, X } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

export interface KkkHubSearchEntry {
  question: string
  slug: string
  categorySlug: string
  categoryTitle: string
}

// Same normalization as the ui SearchableAccordion: NFD strip of combining
// marks plus explicit Estonian õ/ä/ö/ü mappings.
const DIACRITIC_MAP: Record<string, string> = {
  õ: 'o', ä: 'a', ö: 'o', ü: 'u',
  Õ: 'O', Ä: 'A', Ö: 'O', Ü: 'U',
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split('')
    .map((ch) => DIACRITIC_MAP[ch] ?? ch)
    .join('')
    .toLowerCase()
}

const MIN_QUERY_LENGTH = 2

export function KkkHubSearch({ entries }: { entries: KkkHubSearchEntry[] }) {
  const [query, setQuery] = useState('')
  const trimmed = query.trim()
  const searching = trimmed.length >= MIN_QUERY_LENGTH

  const results = useMemo(() => {
    if (!searching) return []
    const needle = normalize(trimmed)
    return entries.filter((entry) => normalize(entry.question).includes(needle))
  }, [entries, searching, trimmed])

  return (
    <div>
      <div role="search" className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-inkMuted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          placeholder="Otsi küsimust…"
          className="w-full rounded-input border border-border bg-white px-10 py-2 text-bodySm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primaryLight"
          aria-label="Otsi kõigi kategooriate küsimuste hulgast"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-inkMuted hover:text-ink"
            aria-label="Tühista otsing"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div aria-live="polite" role="status" className="sr-only">
        {searching ? `Leiti ${String(results.length)} vastust` : ''}
      </div>

      {searching && (
        <div className="mt-4">
          {results.length === 0 ? (
            <div className="rounded-card border border-border bg-bgMist p-md text-center text-body text-inkMuted">
              Ei leidnud vastust. Proovi teist sõna või{' '}
              <Link
                href="/kontakt"
                className="font-semibold text-primary underline hover:no-underline"
              >
                kirjuta meile
              </Link>
              .
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-white">
              {results.map((entry) => (
                <li key={`${entry.categorySlug}-${entry.slug}`}>
                  <Link
                    href={`/kkk/${entry.categorySlug}#q-${entry.slug}`}
                    className="flex flex-col gap-0.5 px-4 py-3 transition-colors duration-hover ease-hover hover:bg-bgMist"
                  >
                    <span className="text-body font-medium text-ink">{entry.question}</span>
                    <span className="text-label text-inkMuted">{entry.categoryTitle}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
