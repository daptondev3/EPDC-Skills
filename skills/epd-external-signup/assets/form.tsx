'use client';

/**
 * EPD external signup form - React / Next.js client component.
 *
 * Copy this file as-is. Change only:
 *   1. ENDPOINT (see below)
 *   2. the styling, to match the host page
 *
 * Do not rename the fields, drop the honeypot, or edit the UTM block.
 * Never put a partnerKey in this file. It reaches the browser.
 * See references/partner-key.md.
 */

import { useState } from 'react';

const EPD_API_BASE = 'https://api-dev.dev1.epd.com';

/**
 * Where this form posts.
 *
 * Default is your own route handler (assets/route.ts), which is required when a
 * partner key is in play and recommended otherwise.
 *
 * No route handler and no partner key? Change this to:
 *   const ENDPOINT = `${EPD_API_BASE}/v1/external-signup`;
 */
const ENDPOINT = '/api/epd-signup';

type FieldError = { field?: string; messages?: string[] };
type SignupResponse = {
  alreadyRegistered?: boolean;
  redirectUrl?: string;
  field_errors?: FieldError[];
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export function EpdSignupForm() {
  const [error, setError] = useState('');
  const [invalidField, setInvalidField] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setInvalidField(undefined);

    const form = event.currentTarget;
    const formData = new FormData(form);

    // Honeypot tripped. Act like it worked and send nothing.
    if (text(formData, 'website')) return;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Build the body from named fields only. Never spread the whole FormData:
    // hidden inputs the host page already had would leak in as unrecognized
    // keys and the API would reject the request.
    const body: Record<string, string> = {
      firstName: text(formData, 'firstName'),
      lastName: text(formData, 'lastName'),
      companyName: text(formData, 'companyName'),
      email: text(formData, 'email'),
    };

    // UTM attribution. Read-only: never written back to the URL or history,
    // never a form field. Each value is sent only when the page URL carries it.
    // No defaults: a bare link produces a signup with no UTM data rather than
    // invented attribution.
    const params = new URLSearchParams(window.location.search);
    const utm = (param: string) => (params.get(param) ?? '').trim().slice(0, 100);
    for (const [bodyKey, param] of [
      ['utmSource', 'utm_source'],
      ['utmMedium', 'utm_medium'],
      ['utmCampaign', 'utm_campaign'],
      ['utmTerm', 'utm_term'],
      ['utmContent', 'utm_content'],
    ] as const) {
      const value = utm(param);
      if (value) body[bodyKey] = value;
    }

    setSubmitting(true);

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        setError('Too many attempts. Please try again in a little while.');
        setSubmitting(false);
        return;
      }

      const data = (await res.json().catch(() => null)) as SignupResponse | null;

      if (!res.ok) {
        const fieldError = data?.field_errors?.[0];
        setError(fieldError?.messages?.[0] ?? 'Please check your details and try again.');
        setInvalidField(fieldError?.field);
        setSubmitting(false);
        return;
      }

      if (!data?.redirectUrl) {
        setError('Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      // Works for both branches: a new lead goes to the OTP step, an existing
      // account goes to login. data.alreadyRegistered tells you which, if you
      // want to show a message before redirecting.
      window.location.href = data.redirectUrl;
      // submitting stays true on purpose while the browser navigates away.
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="epd-first-name">First name</label>
        <input
          id="epd-first-name"
          name="firstName"
          type="text"
          autoComplete="given-name"
          required
          minLength={2}
          maxLength={20}
          pattern="[\p{L}\p{M} .'\-]{2,20}"
          aria-invalid={invalidField === 'firstName' || undefined}
        />
      </div>

      <div>
        <label htmlFor="epd-last-name">Last name</label>
        <input
          id="epd-last-name"
          name="lastName"
          type="text"
          autoComplete="family-name"
          required
          minLength={2}
          maxLength={20}
          pattern="[\p{L}\p{M} .'\-]{2,20}"
          aria-invalid={invalidField === 'lastName' || undefined}
        />
      </div>

      <div>
        <label htmlFor="epd-company">Company name</label>
        <input
          id="epd-company"
          name="companyName"
          type="text"
          autoComplete="organization"
          required
          minLength={3}
          maxLength={150}
          aria-invalid={invalidField === 'companyName' || undefined}
        />
      </div>

      <div>
        <label htmlFor="epd-email">Work email</label>
        <input
          id="epd-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={invalidField === 'email' || undefined}
        />
      </div>

      {/* Honeypot. Hidden from people, filled by bots. Do not remove. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
        <label htmlFor="epd-website">Website</label>
        <input id="epd-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Please wait...' : 'Next'}
      </button>

      <p role="alert" style={{ color: '#c00', minHeight: '1.25rem' }}>
        {error}
      </p>
    </form>
  );
}
