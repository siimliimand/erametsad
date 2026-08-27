'use client';

export interface ChipNavItem {
  id: string;
  label: string;
  count?: number;
}

export interface ChipNavProps {
  items: ChipNavItem[];
  activeId?: string;
  onChange: (id: string) => void;
}

export function ChipNav({ items, activeId, onChange }: ChipNavProps) {
  return (
    <nav aria-label="Filter navigation">
      <div className="flex flex-row gap-2 overflow-x-auto flex-nowrap">
        {items.map((item) => {
          const isActive = item.id === activeId;

          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-4 py-2 text-bodySm font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
                isActive
                  ? 'bg-primary text-ink-inverse'
                  : 'bg-bgMist text-ink border border-border hover:bg-primary-light'
              }`}
              aria-pressed={isActive}
            >
              {item.label}
              {item.count !== undefined && (
                <span
                  className={`ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill px-1.5 text-label font-bold ${
                    isActive ? 'bg-ink-inverse/20 text-ink-inverse' : 'bg-primary text-ink-inverse'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}