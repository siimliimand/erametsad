'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'cta' | 'outline' | 'ghost';
type Size = 'lg' | 'md' | 'sm';

const variantStyles: Record<Variant, string> = {
  primary: 'bg-primary text-ink-inverse hover:bg-primary-hover',
  cta: 'bg-cta text-ink hover:bg-cta-hover',
  outline:
    'border border-primary text-primary bg-transparent hover:bg-primary-light',
  ghost: 'bg-transparent text-primary hover:bg-primary-light',
};

const sizeStyles: Record<Size, string> = {
  lg: 'h-12 px-6',
  md: 'h-10 px-4',
  sm: 'h-8 px-3',
};

export interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  asChild?: boolean;
  children?: ReactNode;
}

function Spinner() {
  return (
    <svg
      className="animate-spin -ml-1 mr-2 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

export const Btn = forwardRef<HTMLButtonElement, BtnProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      asChild = false,
      children,
      className = '',
      disabled,
      ...rest
    },
    ref,
  ) => {
    const classes = `inline-flex items-center justify-center gap-2 rounded-button font-label font-semibold transition-all duration-hover ease-hover motion-reduce:transition-none w-full md:w-auto ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

    if (asChild) {
      return <>{children}</>;
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || isLoading}
        {...rest}
      >
        {isLoading && <Spinner />}
        {children}
      </button>
    );
  },
);

Btn.displayName = 'Btn';
