'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { Accordion } from '../Accordion';
import { Search, X } from 'lucide-react';

export interface SearchableItem {
  q: string;
  a: ReactNode;
  slug: string;
}

export interface SearchableAccordionProps {
  items: SearchableItem[];
  className?: string;
}

const DIACRITIC_MAP: Record<string, string> = {
  õ: 'o', ä: 'a', ö: 'o', ü: 'u',
  Õ: 'O', Ä: 'A', Ö: 'O', Ü: 'U',
};

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split('')
    .map((ch) => DIACRITIC_MAP[ch] ?? ch)
    .join('')
    .toLowerCase();
}

function matchesFilter(q: string, filter: string): boolean {
  return normalize(q).includes(normalize(filter));
}

function splitLongAnswer(a: ReactNode): { teaser: ReactNode; rest: ReactNode } | null {
  if (typeof a !== 'string') return null;
  if (a.length <= 300) return null;
  return { teaser: a.slice(0, 300) + '…', rest: a.slice(300) };
}

export function SearchableAccordion({ items, className = '' }: SearchableAccordionProps) {
  const [query, setQuery] = useState('');
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash.startsWith('q-')) {
      const slug = hash.slice(2);
      setExpandedSlugs((prev) => new Set(prev).add(slug));
      setTimeout(() => {
        const el = document.getElementById(hash);
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    return items.filter((item) => matchesFilter(item.q, query));
  }, [items, query]);

  const accordionItems = useMemo(
    () =>
      filtered.map((item) => {
        const split = splitLongAnswer(item.a);
        const isExpanded = expandedSlugs.has(item.slug);
        const content = split && !isExpanded ? split.teaser : item.a;

        return {
          id: `q-${item.slug}`,
          title: item.q,
          content: (
            <div>
              <div>{content}</div>
              {split && !isExpanded && (
                <button
                  type="button"
                  className="mt-2 text-primary text-bodySm font-semibold hover:underline"
                  onClick={() => {
                    setExpandedSlugs((prev) => new Set(prev).add(item.slug));
                  }}
                >
                  Loe edasi…
                </button>
              )}
            </div>
          ),
        };
      }),
    [filtered, expandedSlugs],
  );

  const clearSearch = useCallback(() => setQuery(''), []);

  return (
    <div className={className}>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Otsi küsimust..."
          className="w-full rounded-lg border border-border bg-bg px-10 py-2 text-bodySm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-light"
          aria-label="Otsi küsimuste hulgast"
        />
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink"
            aria-label="Tühista otsing"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div aria-live="polite" className="sr-only" role="status">
        {query ? `Leiti ${filtered.length} vastust` : `${items.length} küsimust`}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-ink-soft">
          <Search className="h-8 w-8" aria-hidden="true" />
          <p className="text-bodySm font-medium">Vastuseid ei leitud</p>
          <button
            type="button"
            onClick={clearSearch}
            className="text-bodySm text-primary underline hover:no-underline"
          >
            Tühista otsing
          </button>
        </div>
      ) : (
        <Accordion variant="multi" items={accordionItems} />
      )}
    </div>
  );
}