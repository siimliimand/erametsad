'use client';

import { Btn, FormInput, Toast } from '@erametsad/ui';
import { useState, type SyntheticEvent } from 'react';

export interface NewsletterBlockProps {
  title?: string;
  description?: string;
  variant?: 'mist' | 'plain';
}

// Spec (marketing-home): the same neutral confirmation for fresh and
// already-subscribed addresses; the endpoint enforces that server-side.
const CONFIRM_TOAST = 'Kontrolli posti — saatsime kinnitussõnumi';
const SUBMIT_ERROR = 'Saatmine ebaõnnestus. Palun proovi hiljem uuesti.';
const EMAIL_REQUIRED = 'Email on kohustuslik';
const EMAIL_INVALID = 'Palun sisesta kehtiv emaili aadress';

export function NewsletterBlock({
  title = 'Uudiskiri',
  description = 'Teavitused uutest oksjonitest ja müüginippidest otse postkasti.',
  variant = 'mist',
}: NewsletterBlockProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null,
  );

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError(EMAIL_REQUIRED);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(EMAIL_INVALID);
      return;
    }

    setError(undefined);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // company_website is the honeypot the route validates.
        body: JSON.stringify({ email: trimmed, company_website: '' }),
      });

      if (res.ok) {
        setToast({ message: CONFIRM_TOAST, type: 'success' });
        setEmail('');
      } else if (res.status === 400) {
        setError(EMAIL_INVALID);
      } else {
        setToast({ message: SUBMIT_ERROR, type: 'error' });
      }
    } catch {
      setToast({ message: SUBMIT_ERROR, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={variant === 'mist' ? 'bg-bgMist' : undefined}>
      <div className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
        <div className="mx-auto max-w-container-sm">
          <h2 className="font-heading text-h2 text-ink">{title}</h2>
          <p className="mt-xs text-body text-inkMuted">{description}</p>
          <form
            onSubmit={(e) => { void handleSubmit(e) }}
            className="mt-md flex flex-col gap-xs"
            noValidate
          >
            <div className="sm:flex-1">
              <FormInput
                label="Email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value) }}
                {...(error ? { error } : {})}
              />
            </div>
            <div
              style={{ position: 'absolute', left: '-9999px' }}
              aria-hidden="true"
            >
              <input
                name="company_website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                defaultValue=""
              />
            </div>
            <Btn type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
              {isSubmitting ? 'Saadan...' : 'Liitun uudiskirjaga'}
            </Btn>
            <p className="mt-2xs text-bodySm text-inkMuted">
              Pärast liitumist saadame kinnituskirja.
            </p>
          </form>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible
          onClose={() => { setToast(null) }}
        />
      )}
    </section>
  );
}
