'use client';

import type { ReactNode, ElementType } from 'react';

export interface EmptyStateProps {
  icon?: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bg-mist">
          <Icon className="h-8 w-8 text-ink-muted" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-heading font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-center text-body text-ink-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}