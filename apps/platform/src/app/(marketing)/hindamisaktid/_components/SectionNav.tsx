'use client';

import { useEffect, useRef, useState } from 'react';

export interface SectionNavItem {
  id: string;
  title: string;
}

export function SectionNav({ sections }: { sections: SectionNavItem[] }) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '');
  const chipListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sections.length === 0) return;

    // Scroll-spy: the viewport is shrunk to a 10% band around its middle,
    // so the active section is the one crossing mid-viewport.
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.isIntersecting);
        }
        const active = sections.find(({ id }) => visible.get(id));
        if (active) setActiveId(active.id);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );

    for (const { id } of sections) {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
      }
    }
    return () => {
      observer.disconnect();
    };
  }, [sections]);

  // Mobile chip bar: keep the active chip auto-centered.
  useEffect(() => {
    const list = chipListRef.current;
    if (!list) return;
    const chip = list.querySelector<HTMLElement>(`[data-section-id="${activeId}"]`);
    if (chip) {
      list.scrollTo({
        left: chip.offsetLeft - (list.clientWidth - chip.clientWidth) / 2,
        behavior: 'smooth',
      });
    }
  }, [activeId]);

  const handleClick = (id: string) => {
    setActiveId(id);
    const el = document.getElementById(id);
    if (!el) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <nav aria-label="Jaotised">
      <div className="sticky top-14 z-30 -mx-md border-b border-border bg-bgPage px-md py-2 md:-mx-lg md:px-lg lg:hidden">
        <div ref={chipListRef} className="flex gap-2 overflow-x-auto">
          {sections.map(({ id, title }, index) => {
            const active = activeId === id;
            return (
              <button
                key={id}
                type="button"
                data-section-id={id}
                onClick={() => {
                  handleClick(id);
                }}
                aria-current={active ? 'true' : undefined}
                className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-pill border px-3 py-1.5 text-bodySm font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
                  active
                    ? 'border-accent bg-accent text-ink'
                    : 'border-border bg-bgPage text-inkMuted hover:bg-primaryLight'
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-label">
                  {index + 1}
                </span>
                {title}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="hidden space-y-1 lg:sticky lg:top-20 lg:block">
        {sections.map(({ id, title }, index) => {
          const active = activeId === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => {
                  handleClick(id);
                }}
                aria-current={active ? 'true' : undefined}
                className="flex w-full items-center gap-3 rounded-button px-2 py-2 text-left transition-colors duration-hover ease-hover motion-reduce:transition-none hover:bg-bgMist"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-label font-semibold ${
                    active ? 'border-accent bg-accent text-ink' : 'border-primary text-primary'
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={`text-bodySm ${active ? 'font-semibold text-primary' : 'text-inkMuted'}`}
                >
                  {title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
