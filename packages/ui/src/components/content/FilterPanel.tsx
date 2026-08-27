'use client';

import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Card, type CardProps } from '../Card';
import { ChipNav, type ChipNavItem } from '../ChipNav';
import { FormRange, type FormRangeProps } from '../form/FormRange';
import { Tabs, type Tab } from '../Tabs';
import { Drawer } from '../Drawer';
import { Btn } from '../Btn';

interface ChipFilter {
  id: string;
  label: string;
  type: 'chip';
  options: { value: string; label: string }[];
}

interface RangeFilter {
  id: string;
  label: string;
  type: 'range';
  range: { min: number; max: number; step?: number };
}

interface TabFilter {
  id: string;
  label: string;
  type: 'tab';
  options?: { value: string; label: string }[];
}

export type FilterDef = ChipFilter | RangeFilter | TabFilter;

export interface FilterPanelProps {
  filters: FilterDef[];
  values: Record<string, string | [number, number]>;
  onChange: (id: string, value: string | [number, number]) => void;
  onClear: () => void;
  activeCount: number;
  isMobile?: boolean;
  className?: string;
}

function ChipFilterInput({
  filter,
  value,
  onChange,
}: {
  filter: ChipFilter;
  value: string;
  onChange: (val: string) => void;
}) {
  const items: ChipNavItem[] = filter.options.map((o) => ({
    id: o.value,
    label: o.label,
  }));
  return (
    <div className="flex flex-col gap-2">
      <span className="text-body font-semibold text-primary">{filter.label}</span>
      <div className="flex flex-wrap gap-2">
        {filter.options.map((opt) => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-4 py-2 text-bodySm font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
                isActive
                  ? 'bg-primary text-ink-inverse'
                  : 'bg-bgMist text-ink border border-border hover:bg-primary-light'
              }`}
              aria-pressed={isActive}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RangeFilterInput({
  filter,
  value,
  onChange,
}: {
  filter: RangeFilter;
  value: [number, number];
  onChange: (val: [number, number]) => void;
}) {
  return (
    <FormRange
      label={filter.label}
      name={filter.id}
      min={filter.range.min}
      max={filter.range.max}
      step={filter.range.step}
      value={value}
      onChange={onChange}
    />
  );
}

function TabFilterInput({
  filter,
  value,
  onChange,
}: {
  filter: TabFilter;
  value: string;
  onChange: (val: string) => void;
}) {
  const tabs: Tab[] = (filter.options ?? []).map((opt) => ({
    id: opt.value,
    label: opt.label,
    content: null,
  }));

  if (tabs.length === 0) return null;

  const activeValue = value || tabs[0].id;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-body font-semibold text-primary">{filter.label}</span>
      <div className="flex flex-wrap gap-1 border-b border-border pb-1">
        {(filter.options ?? []).map((opt) => {
          const isActive = activeValue === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`relative px-4 py-2 text-label font-semibold whitespace-nowrap transition-colors duration-hover ease-hover ${
                isActive
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-ink-muted hover:text-primary'
              }`}
              role="tab"
              aria-selected={isActive}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterItem({
  filter,
  value,
  onChange,
}: {
  filter: FilterDef;
  value: string | [number, number];
  onChange: (val: string | [number, number]) => void;
}) {
  switch (filter.type) {
    case 'chip':
      return (
        <ChipFilterInput
          filter={filter as ChipFilter}
          value={value as string}
          onChange={(v) => onChange(v)}
        />
      );
    case 'range':
      return (
        <RangeFilterInput
          filter={filter as RangeFilter}
          value={value as [number, number]}
          onChange={(v) => onChange(v)}
        />
      );
    case 'tab':
      return (
        <TabFilterInput
          filter={filter as TabFilter}
          value={value as string}
          onChange={(v) => onChange(v)}
        />
      );
    default:
      return null;
  }
}

function FilterPanelContent({
  filters,
  values,
  onChange,
  onClear,
  activeCount,
}: {
  filters: FilterDef[];
  values: Record<string, string | [number, number]>;
  onChange: (id: string, value: string | [number, number]) => void;
  onClear: () => void;
  activeCount: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      {filters.map((filter) => {
        const value = values[filter.id] ?? (filter.type === 'range' ? [filter.range.min, filter.range.max] as [number, number] : '');
        return (
          <FilterItem
            key={filter.id}
            filter={filter}
            value={value}
            onChange={(v) => onChange(filter.id, v)}
          />
        );
      })}

      {activeCount > 0 && (
        <Btn variant="outline" onClick={onClear} className="w-full">
          Tühjenda
        </Btn>
      )}
    </div>
  );
}

export function FilterPanel({
  filters,
  values,
  onChange,
  onClear,
  activeCount,
  isMobile = false,
  className = '',
}: FilterPanelProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setDrawerOpen(true)}
          className={`inline-flex items-center gap-2 rounded-button bg-bgPage border border-border px-4 py-2 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:bg-primary-light ${className}`}
          aria-label="Filtrid"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filtrid</span>
          {activeCount > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-primary px-1.5 text-[11px] font-bold text-ink-inverse">
              {activeCount}
            </span>
          )}
        </button>

        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Filtrid"
          position="right"
          width="w-80"
        >
          <FilterPanelContent
            filters={filters}
            values={values}
            onChange={onChange}
            onClear={onClear}
            activeCount={activeCount}
          />
        </Drawer>
      </>
    );
  }

  const headerRight = activeCount > 0 ? (
    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-primary px-1.5 text-[11px] font-bold text-ink-inverse">
      {activeCount}
    </span>
  ) : null;

  return (
    <Card
      className={className}
      content={
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-heading font-semibold text-ink">Filtrid</span>
            {headerRight}
          </div>
          <FilterPanelContent
            filters={filters}
            values={values}
            onChange={onChange}
            onClear={onClear}
            activeCount={activeCount}
          />
        </div>
      }
    />
  );
}