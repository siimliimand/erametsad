import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LeadForm } from '../components/form/LeadForm';

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function fillValidForm() {
  fireEvent.change(screen.getByRole('textbox', { name: /Nimi/ }), {
    target: { value: 'Mart Tamm' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: /Telefon/ }), {
    target: { value: '+3725123456' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: /Email/ }), {
    target: { value: 'mart@example.com' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: /Katastritunnus/ }), {
    target: { value: '34801:001:0217' },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: /Nõustun/ }));
}

describe('LeadForm', () => {
  it('posts the payload contract expected by POST /api/leads', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetchMock);

    render(<LeadForm slug="regress" />);
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Saada' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    // Server route validates these exact keys (camelCase).
    expect(body.contactName).toBe('Mart Tamm');
    expect(body.phone).toBe('+3725123456');
    expect(body.email).toBe('mart@example.com');
    expect(body.cadastr).toBe('34801:001:0217');
    expect(body.formName).toEqual(expect.stringMatching(/^regress-\d{3}$/));
    expect(body.pageSlug).toBe('regress');
    expect(body.company_website).toBe('');

    // consentAt must be a parseable ISO timestamp, not the old boolean.
    expect(typeof body.consentAt).toBe('string');
    expect(Number.isNaN(Date.parse(body.consentAt as string))).toBe(false);

    // The stale keys that caused "Nimi on kohustuslik" 400s must not return.
    expect(body).not.toHaveProperty('name');
    expect(body).not.toHaveProperty('cadastre');
    expect(body).not.toHaveProperty('consent');
    expect(body).not.toHaveProperty('form_name');
  });

  it('shows the success toast when the API accepts the lead', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetchMock);

    render(<LeadForm slug="regress" />);
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Saada' }));

    await waitFor(() => {
      expect(screen.getByText(/Sõnum on saadetud/)).toBeInTheDocument();
    });
  });

  it('does not submit when consent is unchecked', () => {
    vi.stubGlobal('fetch', fetchMock);

    render(<LeadForm slug="regress" />);
    fireEvent.change(screen.getByRole('textbox', { name: /Nimi/ }), {
      target: { value: 'Mart Tamm' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Telefon/ }), {
      target: { value: '+3725123456' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Email/ }), {
      target: { value: 'mart@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Saada' }));

    expect(screen.getByText(/Andmete töötlemisega nõustumine on kohustuslik/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the error toast when the API rejects the lead', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 });
    vi.stubGlobal('fetch', fetchMock);

    render(<LeadForm slug="regress" />);
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Saada' }));

    await waitFor(() => {
      expect(screen.getByText(/Saatmine ebaõnnestus/)).toBeInTheDocument();
    });
  });
});
