'use client';

import { Btn, FormInput, Toast } from '@eametsad/ui';
import { useState, type SyntheticEvent } from 'react';

const SUCCESS_MESSAGE = 'Kontrolli posti — saatsime kinnitussõnumi';
const GENERIC_ERROR = 'Sisemine viga';

interface NewsletterResponse {
  status?: string;
  message?: string;
  error?: string;
}

// Version-notification signup for /lepingud/dokumendid. It rides the shared
// newsletter endpoint (email + honeypot, double opt-in); NewsletterBlock
// (task 3.1) owns the generic marketing form, this one stays local so the
// two tasks do not collide.
export function VersionNotifyForm() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const honeypot = form.elements.namedItem('company_website');
    const honeypotValue =
      honeypot instanceof HTMLInputElement ? honeypot.value : '';
    void submit(form, honeypotValue);
  }

  async function submit(form: HTMLFormElement, honeypotValue: string) {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company_website: honeypotValue }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as NewsletterResponse | null;
      if (response.ok) {
        setEmail('');
        form.reset();
        setToast({ message: SUCCESS_MESSAGE, type: 'success' });
      } else {
        setToast({ message: payload?.error ?? GENERIC_ERROR, type: 'error' });
      }
    } catch {
      setToast({ message: GENERIC_ERROR, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-sm" noValidate>
        <FormInput
          label="E-posti aadress"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />

        {/* Honeypot, same pattern as LeadForm: off-screen, not focusable. */}
        <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
          <input
            name="company_website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </div>

        <Btn type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
          {isSubmitting ? 'Saadan...' : 'Liitu'}
        </Btn>
      </form>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible
          onClose={() => {
            setToast(null);
          }}
        />
      )}
    </div>
  );
}
