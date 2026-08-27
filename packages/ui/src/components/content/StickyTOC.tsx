'use client';

import { useEffect, useRef, useState } from 'react';
import { ListOrdered } from 'lucide-react';

export interface TOCSection {
  id: string;
  title: string;
}

export interface StickyTOCProps {
  sections: TOCSection[];
  className?: string;
}

export function StickyTOC({ sections, className = '' }: StickyTOCProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0,
      },
    );

    observerRef.current = observer;

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setActiveId(id);
    }
  };

  return (
    <nav aria-label="Sisukord" className={className}>
      <div className="hidden lg:sticky lg:top-8 lg:block">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-soft">
          <ListOrdered className="h-4 w-4" />
          <span>Sisukord</span>
        </div>
        <ul className="space-y-1">
          {sections.map(({ id, title }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => handleClick(id)}
                className={`block w-full rounded px-3 py-1.5 text-left text-sm transition-colors duration-hover ease-hover motion-reduce:transition-none ${
                  activeId === id
                    ? 'bg-primary-light text-primary font-semibold'
                    : 'text-ink-soft hover:text-ink hover:bg-bgMist'
                }`}
              >
                {title}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="lg:hidden">
        <div className="flex flex-row gap-2 overflow-x-auto flex-nowrap pb-2">
          {sections.map(({ id, title }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleClick(id)}
              className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-pill px-4 py-2 text-bodySm font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
                activeId === id
                  ? 'bg-primary text-ink-inverse'
                  : 'bg-bgMist text-ink border border-border hover:bg-primary-light'
              }`}
            >
              {title}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}