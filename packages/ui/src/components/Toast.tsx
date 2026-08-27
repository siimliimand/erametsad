'use client';

import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

const typeStyles: Record<NonNullable<ToastProps['type']>, string> = {
  success: 'bg-status-active text-ink-inverse',
  error: 'bg-danger text-ink-inverse',
  info: 'bg-info text-ink-inverse',
};

const typeIcons: Record<NonNullable<ToastProps['type']>, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

export function Toast({
  message,
  type = 'info',
  isVisible,
  onClose,
  duration = 4000,
}: ToastProps) {
  useEffect(() => {
    if (!isVisible) return;

    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const Icon = typeIcons[type];

  return (
    <div
      role="alert"
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-button px-4 py-3 shadow-card ${typeStyles[type]}`}
      style={{
        animation: 'toastFadeIn 300ms cubic-bezier(0.22, 0.61, 0.36, 1)',
      }}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="text-bodySm font-medium">{message}</p>
      <button
        onClick={onClose}
        className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-white/20 transition-colors duration-hover ease-hover"
        aria-label="Sulge"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}