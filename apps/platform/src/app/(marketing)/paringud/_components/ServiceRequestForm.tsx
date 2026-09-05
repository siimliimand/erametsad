'use client';

import {
  type ServiceRequestType,
  EE_COUNTIES,
  HOOLDUSRAIE_SERVICE_OPTIONS,
  ISTUTAMINE_SERVICE_OPTIONS,
  parseCadastres,
  serviceRequestPayloadSchema,
  splitCadastreInput,
} from '@erametsad/types';
import {
  Btn,
  ConsentCheck,
  EmptyState,
  FormCheck,
  FormFile,
  FormInput,
  FormSelect,
  Toast,
} from '@erametsad/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import {
  type ChangeEvent,
  type SyntheticEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { useRequestDraft } from '../_lib/use-request-draft';

import { track } from '@/lib/analytics/track';

const SUBMIT_URL = '/api/v1/service-requests';
const FILE_MAX_BYTES = 10 * 1024 * 1024;
const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png';

// Analytics: this kit fires every spec'd event itself through the
// consent-gated track() — pages must not re-fire them.
//   tab_switch (RequestTabs, on click), service_request_start (first field
//   interaction), service_request_validation_error {field} (client-side
//   failure or 422), service_request_complete {routed_count,
//   routed_count_bucket} (success with a known routedCount; buckets 0 |
//   1-2 | 3+).

const SERVICE_NAME: Record<ServiceRequestType, string> = {
  kava: 'metsamajanduskava',
  hooldusraie: 'hooldusraie',
  istutamine: 'metsa istutamise',
};

const DEFAULT_CONSENT_LABEL = (type: ServiceRequestType): string =>
  `Nõustun, et minu andmed edastatakse ${SERVICE_NAME[type]} teenuse pakkujatele, kes võivad minuga ühendust võtta.`;

const DEFAULT_LABELS = {
  name: 'Sinu nimi',
  phone: 'Telefoninumber',
  email: 'E-mail',
  cadastres: 'Metsamaa katastritunnus(ed)',
  county: 'Maakond',
  provisions: 'Ülesanded ja tingimused',
  paperCopy: 'Soovin lisaks kava paberkandjal',
  comment: 'Lisa kommentaar',
  file: 'Lisa kava fail (valikuline)',
  submit: 'Saada päring',
  servicesLegend: 'Millist teenust vajate?',
} as const;

export interface ServiceRequestFormLabels {
  name?: string;
  phone?: string;
  email?: string;
  cadastres?: string;
  county?: string;
  provisions?: string;
  paperCopy?: string;
  comment?: string;
  file?: string;
  submit?: string;
  servicesLegend?: string;
  consent?: string;
}

export interface ServiceRequestFormProps {
  type: ServiceRequestType;
  formName: string;
  pageSlug: string;
  /** Text overrides; defaults keep the per-type pages thin. */
  labels?: ServiceRequestFormLabels;
  /** Extra hint under the comment field (e.g. "nt pindala hektarites"). */
  commentHint?: string;
  successTitle?: string;
}

interface RequestDraftData {
  name: string;
  phone: string;
  email: string;
  cadastres: string;
  county: string;
  provisions: string;
  services: string[];
  paperCopy: boolean;
  comment: string;
}

type TextFieldKey = 'name' | 'phone' | 'email' | 'cadastres' | 'provisions' | 'comment';

// Consent state and the file never enter this object, so the draft can
// never persist them (GDPR requirement from the spec).
const EMPTY_DRAFT: RequestDraftData = {
  name: '',
  phone: '',
  email: '',
  cadastres: '',
  county: '',
  provisions: '',
  services: [],
  paperCopy: false,
  comment: '',
};

const TEXT_ERROR_KEYS: Record<TextFieldKey, string> = {
  name: 'contact.name',
  phone: 'contact.phone',
  email: 'contact.email',
  cadastres: 'cadastres',
  provisions: 'provisions',
  comment: 'comment',
};

const COUNTY_OPTIONS = EE_COUNTIES.map(({ code, name }) => ({ value: code, label: name }));

const NETWORK_ERROR = 'Ei õnnestunud saata. Kontrollige võrguühendust ja proovige uuesti.';
const SUBMIT_FAILED = 'Saatmine ebaõnnestus. Proovige mõne aja pärast uuesti.';

const formCardClass = 'rounded-card border border-border bg-bgPage p-md shadow-card md:p-lg';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function routedCountBucket(routedCount: number): '0' | '1-2' | '3+' {
  if (routedCount === 0) return '0';
  return routedCount <= 2 ? '1-2' : '3+';
}

function firstErrorKey(errors: Record<string, string>): string {
  return Object.keys(errors)[0] ?? 'form';
}

function pickDraftFields(stored: Record<string, unknown>): Partial<RequestDraftData> {
  const out: Partial<RequestDraftData> = {};
  for (const key of ['name', 'phone', 'email', 'cadastres', 'county', 'provisions', 'comment'] as const) {
    const value = stored[key];
    if (typeof value === 'string') out[key] = value;
  }
  if (Array.isArray(stored.services)) {
    out.services = stored.services.filter((entry): entry is string => typeof entry === 'string');
  }
  if (typeof stored.paperCopy === 'boolean') out.paperCopy = stored.paperCopy;
  return out;
}

interface SubmitHttpResponse {
  status: number;
  body: unknown;
}

export function ServiceRequestForm({
  type,
  formName,
  pageSlug,
  labels,
  commentHint,
  successTitle = 'Aitäh! Päring on esitatud.',
}: ServiceRequestFormProps) {
  const merged = { ...DEFAULT_LABELS, ...labels };
  const consentLabel = labels?.consent ?? DEFAULT_CONSENT_LABEL(type);
  const isKava = type === 'kava';
  const withFile = type === 'hooldusraie';

  const serviceOptions =
    type === 'hooldusraie'
      ? HOOLDUSRAIE_SERVICE_OPTIONS
      : type === 'istutamine'
        ? ISTUTAMINE_SERVICE_OPTIONS
        : [];

  const { readDraft, writeDraft, clearDraft } = useRequestDraft(formName);

  const [fields, setFields] = useState<RequestDraftData>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File[]>([]);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [success, setSuccess] = useState<number | null | undefined>(undefined);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const consentAtRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const successRef = useRef(false);
  const commentId = useId();

  // Restore the draft after mount (never during SSR render). Consent stays
  // unchecked because it is not part of the stored data.
  useEffect(() => {
    const stored = readDraft();
    if (stored) {
      setFields((prev) => ({ ...prev, ...pickDraftFields(stored) }));
    }
    setHydrated(true);
  }, [readDraft]);

  // Persist the draft on every change; content is limited to RequestDraftData.
  useEffect(() => {
    if (!hydrated || successRef.current) return;
    writeDraft({ ...fields });
  }, [fields, hydrated, writeDraft]);

  const markStarted = (): void => {
    if (startedRef.current) return;
    startedRef.current = true;
    track('service_request_start', { form_name: formName, page_slug: pageSlug });
  };

  const dropError = (key: string): void => {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      return Object.fromEntries(Object.entries(prev).filter(([entryKey]) => entryKey !== key));
    });
  };

  const updateTextField =
    (key: TextFieldKey) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    markStarted();
    const value = event.target.value;
    setFields((prev) => ({ ...prev, [key]: value }));
    dropError(TEXT_ERROR_KEYS[key]);
  };

  const updateCounty = (event: ChangeEvent<HTMLSelectElement>) => {
    markStarted();
    const value = event.target.value;
    setFields((prev) => ({ ...prev, county: value }));
    dropError('county');
  };

  const toggleService = (value: string, checked: boolean): void => {
    markStarted();
    setFields((prev) => ({
      ...prev,
      services: checked
        ? [...prev.services.filter((entry) => entry !== value), value]
        : prev.services.filter((entry) => entry !== value),
    }));
    dropError('services');
  };

  const handleConsent = (checked: boolean): void => {
    markStarted();
    setConsent(checked);
    consentAtRef.current = checked ? new Date().toISOString() : null;
    dropError('consentAt');
  };

  const validate = (): Record<string, string> => {
    const body: Record<string, unknown> = {
      type,
      contact: { name: fields.name, phone: fields.phone, email: fields.email },
      cadastres: fields.cadastres,
    };
    if (isKava) {
      if (fields.paperCopy) body.paper_copy = true;
    } else {
      body.county = fields.county;
      body.provisions = fields.provisions;
      body.services = fields.services;
    }
    if (fields.comment.trim() !== '') body.comment = fields.comment;

    const nextErrors: Record<string, string> = {};
    const parsed = serviceRequestPayloadSchema.safeParse(body);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const rawKey = issue.path.map(String).join('.') || 'form';
        const key =
          rawKey === 'type' ? 'form' : rawKey.startsWith('services') ? 'services' : rawKey;
        if (!(key in nextErrors)) nextErrors[key] = issue.message;
      }
    }

    // Per-entry cadastral errors via the shared parser (values + positions).
    if (splitCadastreInput(fields.cadastres).length === 0) {
      nextErrors.cadastres = 'Sisestage vähemalt üks katastriüksus';
    } else {
      const { invalid } = parseCadastres(fields.cadastres);
      if (invalid.length > 0) {
        nextErrors.cadastres = invalid
          .map(
            ({ index, value }) =>
              `${String(index)}. katastriüksus "${value}" peab vastama vormingule NNNNN:NNN:NNNN`,
          )
          .join(' ');
      }
    }

    if (!consent) nextErrors.consentAt = 'Nõusolek on kohustuslik';
    return nextErrors;
  };

  // JSON transport gets native shapes (boolean paper_copy, services array);
  // multipart gets the flat strings the API's form parser expects.
  const buildBodyFields = (multipart: boolean): Record<string, unknown> => ({
    type,
    name: fields.name.trim(),
    phone: fields.phone.trim(),
    email: fields.email.trim(),
    cadastres: fields.cadastres,
    ...(isKava
      ? { paper_copy: multipart ? (fields.paperCopy ? 'true' : 'false') : fields.paperCopy }
      : {
          county: fields.county,
          provisions: fields.provisions.trim(),
          services: multipart ? fields.services.join(',') : fields.services,
        }),
    ...(fields.comment.trim() !== '' ? { comment: fields.comment.trim() } : {}),
    company_website: honeypot,
    consentAt: consentAtRef.current ?? '',
    formName,
    pageSlug,
  });

  const sendJson = async (): Promise<SubmitHttpResponse> => {
    const response = await fetch(SUBMIT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildBodyFields(false)),
    });
    let body: unknown = null;
    try {
      body = (await response.json()) as unknown;
    } catch {
      body = null;
    }
    return { status: response.status, body };
  };

  const sendMultipart = (): Promise<SubmitHttpResponse> => {
    const data = new FormData();
    for (const [key, value] of Object.entries(buildBodyFields(true))) {
      if (typeof value === 'string') data.set(key, value);
    }
    if (file[0]) data.set('file', file[0]);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', SUBMIT_URL);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          setProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        }
      };
      xhr.onerror = () => {
        reject(new TypeError('Network request failed'));
      };
      xhr.ontimeout = () => {
        reject(new TypeError('Network request timed out'));
      };
      xhr.onload = () => {
        let body: unknown = null;
        try {
          body = JSON.parse(xhr.responseText) as unknown;
        } catch {
          body = null;
        }
        resolve({ status: xhr.status, body });
      };
      xhr.send(data);
    });
  };

  const handleResponse = ({ status, body }: SubmitHttpResponse): void => {
    if ((status === 200 || status === 201) && isRecord(body) && body.status === 'ok') {
      // Honeypot neutral success has no routedCount — treat as success.
      const routedCount = typeof body.routedCount === 'number' ? body.routedCount : null;
      successRef.current = true;
      clearDraft();
      setSuccess(routedCount);
      setToast({
        message: routedCount === 0 ? 'Päring salvestati.' : 'Päring on saadetud!',
        type: 'success',
      });
      if (routedCount !== null) {
        track('service_request_complete', {
          form_name: formName,
          page_slug: pageSlug,
          routed_count: routedCount,
          routed_count_bucket: routedCountBucket(routedCount),
        });
      }
      return;
    }

    if ((status === 422 || status === 503) && isRecord(body) && isRecord(body.errors)) {
      const fieldErrors: Record<string, string> = {};
      for (const [key, value] of Object.entries(body.errors)) {
        if (typeof value === 'string') fieldErrors[key] = value;
      }
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        if (status === 422) {
          track('service_request_validation_error', {
            field: firstErrorKey(fieldErrors),
            form_name: formName,
          });
        }
        return;
      }
    }

    if (isRecord(body) && typeof body.error === 'string') {
      setFormError(body.error);
      return;
    }
    setFormError(SUBMIT_FAILED);
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (submitting) return;

    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setFormError(null);
      track('service_request_validation_error', {
        field: firstErrorKey(clientErrors),
        form_name: formName,
      });
      return;
    }

    setErrors({});
    setFormError(null);
    setSubmitting(true);
    setProgress(null);

    const send = withFile ? sendMultipart() : sendJson();
    send
      .then(handleResponse)
      .catch(() => {
        // Network failure: form data stays intact for retry.
        setFormError(NETWORK_ERROR);
      })
      .finally(() => {
        setSubmitting(false);
        setProgress(null);
      });
  };

  if (success !== undefined) {
    const successDescription =
      success === null
        ? 'Päring on saadetud.'
        : success === 0
          ? 'Päring salvestati, võtame ise ühendust.'
          : `Päring edastati ${String(success)} partnerile. Pakkumised laekuvad tavaliselt 7 päeva jooksul.`;
    return (
      <>
        <div className={formCardClass}>
          <EmptyState
            icon={CheckCircle2}
            title={successTitle}
            description={successDescription}
            action={
              <Link
                href="/paringud"
                className="inline-flex h-10 items-center justify-center rounded-button border border-primary px-4 font-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight motion-reduce:transition-none"
              >
                Tagasi päringute avalehele
              </Link>
            }
          />
        </div>
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
      </>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className={`${formCardClass} flex flex-col gap-md`}>
        <FormInput
          label={merged.name}
          name="name"
          required
          autoComplete="name"
          value={fields.name}
          onChange={updateTextField('name')}
          {...(errors['contact.name'] ? { error: errors['contact.name'] } : {})}
        />

        <FormInput
          label={merged.phone}
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          hint="Vorming +37251234567"
          value={fields.phone}
          onChange={updateTextField('phone')}
          {...(errors['contact.phone'] ? { error: errors['contact.phone'] } : {})}
        />

        <FormInput
          label={merged.email}
          name="email"
          type="email"
          required
          autoComplete="email"
          value={fields.email}
          onChange={updateTextField('email')}
          {...(errors['contact.email'] ? { error: errors['contact.email'] } : {})}
        />

        <FormInput
          label={merged.cadastres}
          name="cadastres"
          required
          hint="Eraldage mitu katastriüksust komade, tühikute või reavahetustega"
          value={fields.cadastres}
          onChange={updateTextField('cadastres')}
          {...(errors.cadastres ? { error: errors.cadastres } : {})}
        />

        {!isKava && (
          <FormSelect
            label={merged.county}
            name="county"
            required
            options={COUNTY_OPTIONS}
            placeholder="Valige maakond"
            value={fields.county}
            onChange={updateCounty}
            {...(errors.county ? { error: errors.county } : {})}
          />
        )}

        {!isKava && (
          <FormInput
            label={merged.provisions}
            name="provisions"
            required
            value={fields.provisions}
            onChange={updateTextField('provisions')}
            {...(errors.provisions ? { error: errors.provisions } : {})}
          />
        )}

        {serviceOptions.length > 0 && (
          <fieldset className="flex flex-col gap-xs">
            <legend className="mb-2xs text-body font-semibold text-primary">
              {merged.servicesLegend}
            </legend>
            {serviceOptions.map((option) => (
              <FormCheck
                key={option.value}
                name="services"
                label={option.label}
                checked={fields.services.includes(option.value)}
                onChange={(event) => {
                  toggleService(option.value, event.target.checked);
                }}
              />
            ))}
            {errors.services && (
              <p role="alert" className="flex items-center gap-1 text-bodySm text-danger">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{errors.services}</span>
              </p>
            )}
          </fieldset>
        )}

        {isKava && (
          <FormCheck
            name="paper_copy"
            label={merged.paperCopy}
            checked={fields.paperCopy}
            onChange={(event) => {
              markStarted();
              const checked = event.target.checked;
              setFields((prev) => ({ ...prev, paperCopy: checked }));
            }}
          />
        )}

        {withFile && (
          <FormFile
            name="file"
            accept={FILE_ACCEPT}
            maxSize={FILE_MAX_BYTES}
            label={merged.file}
            hint="PDF, JPG või PNG kuni 10 MB"
            onChange={(files) => {
              markStarted();
              setFile(files);
              dropError('file');
            }}
            {...(errors.file ? { error: errors.file } : {})}
          />
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor={commentId} className="text-body font-semibold text-primary">
            {merged.comment}
          </label>
          <textarea
            id={commentId}
            name="comment"
            rows={4}
            value={fields.comment}
            onChange={updateTextField('comment')}
            aria-invalid={!!errors.comment}
            aria-describedby={commentHint ? `${commentId}-hint` : undefined}
            className="w-full rounded-input border border-border bg-bgPage p-3 text-body outline-none transition-all duration-hover ease-hover motion-reduce:transition-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {commentHint && !errors.comment && (
            <p id={`${commentId}-hint`} className="text-bodySm text-inkMuted">
              {commentHint}
            </p>
          )}
        </div>

        {/* Honeypot: hidden from humans, included in every submission. */}
        <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
          <input
            name="company_website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => {
              setHoneypot(event.target.value);
            }}
          />
        </div>

        <ConsentCheck
          name="consent"
          label={consentLabel}
          onChange={handleConsent}
          {...(errors.consentAt ? { error: errors.consentAt } : {})}
        />

        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-input border border-danger bg-danger/5 px-4 py-3 text-bodySm text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        <Btn type="submit" variant="cta" size="lg" isLoading={submitting} disabled={submitting}>
          {submitting
            ? progress !== null
              ? `Saadan… ${String(progress)}%`
              : 'Saadan…'
            : merged.submit}
        </Btn>

        <p role="status" aria-live="polite" className="sr-only">
          {submitting
            ? progress !== null
              ? `Päringu saatmine, ${String(progress)} protsenti`
              : 'Päringu saatmine'
            : ''}
        </p>
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
    </>
  );
}
