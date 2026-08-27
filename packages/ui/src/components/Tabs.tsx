'use client';

import { useState, type ReactNode } from 'react';

export interface Tab {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
}

export interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
}

export function Tabs({ tabs, defaultTab }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? '');

  const active = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <div>
      <div
        className="overflow-x-auto border-b border-border"
        role="tablist"
      >
        <div className="flex gap-0 min-w-max">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-label font-semibold whitespace-nowrap transition-colors duration-hover ease-hover ${
                  isActive
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-ink-muted border-b-2 border-transparent hover:text-primary hover:border-primary'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-pill text-[11px] font-semibold bg-primary-light text-primary">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {active && (
        <div
          role="tabpanel"
          id={`tabpanel-${active.id}`}
          aria-labelledby={`tab-${active.id}`}
          className="pt-md"
        >
          {active.content}
        </div>
      )}
    </div>
  );
}