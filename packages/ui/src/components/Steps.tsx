'use client';

import { Check } from 'lucide-react';

export interface StepItem {
  id: string;
  label: string;
  description?: string;
  status: 'completed' | 'current' | 'upcoming';
}

export interface StepsProps {
  steps: StepItem[];
  variant?: 'numbered' | 'emphasis';
  orientation?: 'vertical' | 'horizontal';
}

function StepIcon({
  status,
  index,
  variant,
}: {
  status: StepItem['status'];
  index: number;
  variant: NonNullable<StepsProps['variant']>;
}) {
  if (status === 'completed') {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-ink-inverse">
        <Check className="h-4 w-4" aria-hidden="true" />
      </div>
    );
  }

  if (status === 'current') {
    const size = variant === 'emphasis' ? 'h-10 w-10' : 'h-8 w-8';
    return (
      <div
        className={`flex ${size} shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary-light text-primary ring-4 ring-primary-light`}
      >
        <span className="text-label font-bold">{index + 1}</span>
      </div>
    );
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-border bg-bgPage text-ink-muted">
      <span className="text-label font-bold">{index + 1}</span>
    </div>
  );
}

export function Steps({
  steps,
  variant = 'numbered',
  orientation = 'vertical',
}: StepsProps) {
  if (orientation === 'horizontal') {
    return (
      <div
        className="flex flex-row items-start gap-0"
        role="list"
        aria-label="Progress steps"
      >
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isCurrent = step.status === 'current';
          const isCompleted = step.status === 'completed';

          return (
            <div
              key={step.id}
              className="flex flex-1 flex-col items-center"
              role="listitem"
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div className="flex w-full flex-col items-center">
                <div className="flex w-full flex-row items-center">
                  {index > 0 && (
                    <div
                      className={`h-0.5 flex-1 ${steps[index - 1]!.status === 'completed' ? 'bg-primary' : 'bg-border'}`}
                      aria-hidden="true"
                    />
                  )}
                  <StepIcon status={step.status} index={index} variant={variant} />
                  {!isLast && (
                    <div
                      className={`h-0.5 flex-1 ${isCompleted ? 'bg-primary' : 'bg-border'}`}
                      aria-hidden="true"
                    />
                  )}
                </div>

                <div className="mt-2 px-1 text-center">
                  <span
                    className={`block text-bodySm font-semibold ${isCurrent || isCompleted ? 'text-primary' : 'text-ink-muted'} ${variant === 'emphasis' && isCurrent ? 'text-body' : ''}`}
                  >
                    {step.label}
                  </span>
                  {step.description && (
                    <span className="mt-0.5 block text-label text-ink-muted">
                      {step.description}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0" role="list" aria-label="Progress steps">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isCurrent = step.status === 'current';
        const isCompleted = step.status === 'completed';

        return (
          <div
            key={step.id}
            className="flex flex-row items-start"
            role="listitem"
            aria-current={isCurrent ? 'step' : undefined}
          >
            <div className="flex flex-col items-center">
              <StepIcon status={step.status} index={index} variant={variant} />
              {!isLast && (
                <div
                  className={`mt-0 h-full min-h-6 w-0.5 ${isCompleted ? 'bg-primary' : 'bg-border'}`}
                  aria-hidden="true"
                />
              )}
            </div>

            <div className="ml-3 pb-6">
              <span
                className={`mt-1 block text-bodySm font-semibold ${isCurrent || isCompleted ? 'text-primary' : 'text-ink-muted'} ${variant === 'emphasis' && isCurrent ? 'text-body' : ''}`}
              >
                {step.label}
              </span>
              {step.description && (
                <span className="mt-0.5 block text-label text-ink-muted">
                  {step.description}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}