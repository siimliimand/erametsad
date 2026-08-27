'use client';

import { useState, useCallback, useRef } from 'react';
import { EEPhone } from '@eametsad/types';
import { FormInput } from './FormInput';
import { ConsentCheck } from './ConsentCheck';
import { Btn } from '../Btn';
import { Toast } from '../Toast';

let formCounter = 0;

export interface LeadFormProps {
  slug: string;
  onSuccess?: () => void;
}

export function LeadForm({ slug, onSuccess }: LeadFormProps) {
  const formNameRef = useRef<string>(`${slug}-${String(++formCounter).padStart(3, '0')}`);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cadastre, setCadastre] = useState('');
  const [consent, setConsent] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Nimi on kohustuslik';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Telefon on kohustuslik';
    } else {
      const result = EEPhone.safeParse(phone);
      if (!result.success) {
        newErrors.phone = 'Palun sisesta kehtiv Eesti telefoninumber (+372XXXXXXXX)';
      }
    }

    if (!email.trim()) {
      newErrors.email = 'Email on kohustuslik';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Palun sisesta kehtiv emaili aadress';
    }

    if (!consent) {
      newErrors.consent = 'Andmete töötlemisega nõustumine on kohustuslik';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, phone, email, consent]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setIsSubmitting(true);
      setToast(null);

      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        cadastre: cadastre.trim() || undefined,
        consent,
        company_website: '',
        form_name: formNameRef.current,
      };

      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error('Viga saatmisel');
        }

        setToast({
          message: 'Sõnum on saadetud! Võtame teiega peagi ühendust.',
          type: 'success',
        });
        setErrors({});
        onSuccess?.();
        setFormKey((k) => k + 1);
      } catch {
        setToast({
          message: 'Saatmine ebaõnnestus. Palun proovi hiljem uuesti.',
          type: 'error',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [validate, name, phone, email, cadastre, consent, onSuccess],
  );

  return (
    <>
      <form
        key={formKey}
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <div className="flex flex-col gap-4">
          <FormInput
            label="Nimi"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            {...(errors.name ? { error: errors.name } : {})}
          />

          <FormInput
            label="Telefon"
            name="phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            {...(errors.phone ? { error: errors.phone } : {})}
          />

          <FormInput
            label="Email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            {...(errors.email ? { error: errors.email } : {})}
          />

          <FormInput
            label="Katastritunnus"
            name="cadastre"
            value={cadastre}
            onChange={(e) => setCadastre(e.target.value)}
            hint="Valikuline — metsaüksuse viitamiseks"
          />
        </div>

        <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
          <input
            name="company_website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </div>

        <input type="hidden" name="form_name" value={formNameRef.current} />

        <ConsentCheck
          name="consent"
          label="Nõustun andmete töötlemisega"
          onChange={setConsent}
          {...(errors.consent ? { error: errors.consent } : {})}
        />

        <Btn
          type="submit"
          isLoading={isSubmitting}
          disabled={isSubmitting}
          className="mt-2"
        >
          {isSubmitting ? 'Saadan...' : 'Saada'}
        </Btn>
      </form>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}