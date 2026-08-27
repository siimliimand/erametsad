'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { ChevronsUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (item: T) => ReactNode;
}

export interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  sortable?: boolean;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
  emptyState?: ReactNode;
  className?: string;
  filters?: Record<string, string>;
}

type SortDirection = 'asc' | 'desc' | 'none';

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="h-10 px-3">
          <div className="h-3 bg-ink-muted/20 rounded w-3/4 animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  sortable = true,
  onSort,
  page,
  totalPages,
  onPageChange,
  isLoading = false,
  emptyState,
  className = '',
  filters = {},
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('none');

  const toggleSort = (key: string) => {
    let next: SortDirection = 'asc';
    if (sortKey === key) {
      if (sortDir === 'asc') next = 'desc';
      else if (sortDir === 'desc') next = 'none';
      else next = 'asc';
    }
    setSortKey(key);
    setSortDir(next);
    if (onSort && next !== 'none') {
      onSort(key, next);
    }
  };

  const filteredData = useMemo(() => {
    let result = data;
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        result = result.filter((item) => {
          const cell = item[key];
          return (
            cell !== undefined &&
            String(cell).toLowerCase().includes(value.toLowerCase())
          );
        });
      }
    }
    return result;
  }, [data, filters]);

  const rows = isLoading ? [] : filteredData;

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => {
              const isActiveSort = sortKey === col.key && sortDir !== 'none';
              const canSort = sortable && col.sortable !== false;

              return (
                <th
                  key={col.key}
                  className={`h-10 px-3 text-left text-label font-semibold text-ink-muted ${canSort ? 'cursor-pointer select-none' : ''} ${isActiveSort ? 'text-primary' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => canSort && toggleSort(col.key)}
                >
                  <div className="flex items-center gap-1.5 group">
                    <span>{col.label}</span>
                    {canSort && (
                      <span className="inline-flex items-center text-ink-muted/50 group-hover:text-ink-muted transition-colors duration-hover ease-hover">
                        {isActiveSort ? (
                          sortDir === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-primary" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="h-20 text-center text-bodySm text-ink-muted"
              >
                {emptyState ?? 'Andmeid pole'}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-b border-border last:border-b-0 hover:bg-bg-mist transition-colors duration-hover ease-hover"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="h-10 px-3 text-bodySm text-ink whitespace-nowrap"
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.render
                      ? col.render(row)
                      : (row[col.key] as ReactNode) ?? '-'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {totalPages !== undefined &&
        totalPages > 1 &&
        page !== undefined &&
        onPageChange && (
          <div className="flex items-center justify-between pt-sm">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="h-8 px-3 text-label font-semibold text-ink-muted hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-hover ease-hover"
            >
              Eelmine
            </button>
            <span className="text-bodySm text-ink-muted">
              Lehekülg {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="h-8 px-3 text-label font-semibold text-ink-muted hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-hover ease-hover"
            >
              Järgmine
            </button>
          </div>
        )}
    </div>
  );
}