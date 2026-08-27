'use client';

import {
  type ReactNode,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  position?: 'right' | 'left';
  width?: string;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  position = 'right',
  width = 'w-80',
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<Element | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  const handleBackdropClick = useCallback(
    (e: MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      previousActiveRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';

      requestAnimationFrame(() => {
        const drawer = drawerRef.current;
        if (!drawer) return;
        const firstFocusable = drawer.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        firstFocusable?.focus();
      });
    }

    return () => {
      document.body.style.overflow = '';
      if (previousActiveRef.current instanceof HTMLElement) {
        previousActiveRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const titleId = 'drawer-title';

  const positionClasses =
    position === 'right'
      ? 'right-0 translate-x-0'
      : 'left-0 translate-x-0';

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/50"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`fixed top-0 h-full ${width} bg-bgPage shadow-modal flex flex-col ${positionClasses}`}
        onKeyDown={handleKeyDown}
        style={{
          animation:
            position === 'right'
              ? 'slideInRight 300ms cubic-bezier(0.22, 0.61, 0.36, 1)'
              : 'slideInLeft 300ms cubic-bezier(0.22, 0.61, 0.36, 1)',
        }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id={titleId} className="text-heading font-semibold text-ink">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-button text-ink-muted hover:bg-primary-light hover:text-ink transition-colors duration-hover ease-hover"
            aria-label="Sulge"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}