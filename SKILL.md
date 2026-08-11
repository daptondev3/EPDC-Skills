---
name: external-signup
description: Use when an external site (blog, partner landing page, marketing microsite) wants to host its own first-touch signup form (first name, last name, company, email) and hand the visitor off to EPD to finish account creation with email OTP + password. Covers the public /auth/external-signup/initiate endpoint, the prefill redirect hand-off, ready-to-paste HTML and React templates, and error handling. The backend base URL is fixed at https://api-dev.dev1.epd.com — never ask the user for it and never set up env files.
---

# EPD External Signup (external first-touch → EPD finish)

Let an **external page you control** collect a lead's **first name, last name, company name, and
email**, then send them to EPD to finish signing up (email OTP + password). The visitor never
re-types their name or company on EPD — those four fields carry across on the redirect. A brand-new
lead lands as an EPD **sandbox/demo account** via EPD's normal signup path; account creation logic is
unchanged.

**Use this when:** you want a signup form living on *your* domain (not an embed/iframe of EPD).
**Don't use this for:** existing merchant API calls — those are the API-key-gated `/v1/*` surface.
This endpoint is deliberately **anonymous** because a not-yet-existing merchant has no API key.

---

## Backend base URL — already decided, don't ask

**`https://api-dev.dev1.epd.com`**

Use it as-is, verbatim, wherever a snippet calls EPD.

- **Never ask the user for the base URL.**
- **Never create, read, or modify `.env` / `.env.local`**, and never use `process.env.*` for it.
  There is no configuration step.

(To target a different backend, edit this skill file before running it — replace every
`https://api-dev.dev1.epd.com` in it.)

---

## The flow

```
Your page                          EPD backend                       EPD /auth page
─────────                          ───────────                       ──────────────
[first/last/company/email]
        │  Next ▶
        │  POST /auth/external-signup/initiate
        └──────────────────────────▶
                                   • validates the 4 fields
                                   • if email already has an EPD
                                     account → returns login URL
                                     (no OTP)
                                   • else → sends 6-digit email OTP
                                     + returns a redirect URL with
                                     the fields as prefill params
        ◀──────────────────────────┘
        │  { alreadyRegistered, redirectUrl }
        │
        │  redirect the browser to redirectUrl
        └───────────────────────────────────────────────────────────▶
                                                                     • reads prefill params
                                                                     • jumps to OTP step, email shown
                                                                     • user enters OTP
                                                                     • password form appears with
                                                                       name/company PRE-FILLED (editable)
                                                                     • Create account → sandbox account,
                                                                       logged in
```

Your only job is: render a form, `POST` to `initiate`, and send the browser to the returned
`redirectUrl`. EPD's `/auth` page handles the OTP → password → account-creation chain.

**Why no signed token?** The prefill fields only pre-fill *editable* form fields; the real gate on
account creation is the **email OTP + the password** the user sets on EPD. So there's nothing secret
to protect — the fields ride on the URL as plain params, and one endpoint is all it takes.

---

## API contract

Base URL: `https://api-dev.dev1.epd.com`. The endpoint is `@Public()` (no auth header).

### `POST /auth/external-signup/initiate`

Rate limited to **5 requests per hour per IP**. Exceeding it returns **429**.

**Request body** (JSON):

| Field         | Rules                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| `email`       | valid email address                                                                    |
| `firstName`   | 2–20 chars; letters, spaces, periods, hyphens, apostrophes only; no HTML               |
| `lastName`    | 2–20 chars; same character set as `firstName`; no HTML                                  |
| `companyName` | 3–150 chars; no HTML                                                                    |

(Name/company rules mirror EPD's own signup form exactly, so a value accepted here also passes the
final account-creation step — no surprise rejection later.)

**Response `200`** — new lead:

```json
{
  "alreadyRegistered": false,
  "redirectUrl": "https://app.epd.example/auth?externalSignup=1&email=ada%40example.com&firstName=Ada&lastName=Lovelace&companyName=Analytical+Engines"
}
```

An OTP email is sent to the address. Redirect the browser to `redirectUrl`. (EPD's `/auth` page reads
the params, jumps to the OTP step, and strips the params from the URL immediately.)

**Response `200`** — email already has an EPD account:

```json
{
  "alreadyRegistered": true,
  "redirectUrl": "https://app.epd.example/auth?login=1&email=ada%40example.com"
}
```

No OTP is sent and no prefill is issued (this prevents the endpoint from being used to spam existing
users). Send the browser to `redirectUrl` — it lands directly on the login screen with the email
pre-filled. You may also show your own "You already have an account — log in" message first.

**Response `400`** — validation failed. EPD's global validation returns a flattened shape:

```json
{ "success": false, "field_errors": [{ "field": "firstName", "messages": ["First name must be at least 2 characters."] }] }
```

**Response `429`** — rate limit exceeded (more than 5 initiations in an hour from that IP).

> The `redirectUrl` is absolute and points at EPD's own frontend. Don't build it yourself — always use
> the value returned, so it stays correct across environments.

---

## Where to call `initiate` from — CORS

EPD's CORS reflects any origin (`Access-Control-Allow-Origin` echoes the caller), so a browser
`fetch` from your page works with **no backend change**. Two options:

- **Server-side (recommended).** Call `initiate` from *your* backend and return `redirectUrl` to your
  page. This keeps the request behind your own rate limiting, hides the traffic from the client, and
  lets you add your own bot/spam checks. The 5/hr limit is per **IP** — from your server that's your
  server's IP, so add your own per-visitor throttle if you go this route.
- **Client-side (simplest).** `fetch` directly from the browser. Fine for low-volume marketing pages.
  The 5/hr limit is then per visitor IP, which is usually what you want.

---

## Ready-to-paste templates

Each template is self-contained and already points at `https://api-dev.dev1.epd.com`. Paste and run —
nothing to configure.

### 1. Plain HTML + vanilla JS (client-side call)

```html
<form id="epd-signup">
  <input name="firstName"   placeholder="First name"   required minlength="2"  maxlength="20" />
  <input name="lastName"    placeholder="Last name"    required minlength="2"  maxlength="20" />
  <input name="companyName" placeholder="Company name" required minlength="3"  maxlength="150" />
  <input name="email"       placeholder="Work email"   required type="email" />
  <button type="submit">Next</button>
  <p id="epd-error" role="alert" style="color:#c00"></p>
</form>

<script>
  const EPD_API_BASE = 'https://api-dev.dev1.epd.com';
  const form = document.getElementById('epd-signup');
  const errorEl = document.getElementById('epd-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const btn = form.querySelector('button');
    btn.disabled = true;

    const body = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch(`${EPD_API_BASE}/auth/external-signup/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        errorEl.textContent = 'Too many attempts. Please try again in a little while.';
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        errorEl.textContent =
          err?.field_errors?.[0]?.messages?.[0] || 'Please check your details and try again.';
        return;
      }

      const { redirectUrl } = await res.json();
      // Works for both branches: new lead → OTP step; existing user → login screen.
      window.location.href = redirectUrl;
    } catch {
      errorEl.textContent = 'Something went wrong. Please try again.';
    } finally {
      btn.disabled = false;
    }
  });
</script>
```

### 2. React / Next.js snippet (client-side call)

```tsx
'use client';

import { useState } from 'react';

const EPD_API_BASE = 'https://api-dev.dev1.epd.com';

export function EpdSignupForm() {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());

    try {
      const res = await fetch(`${EPD_API_BASE}/auth/external-signup/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        setError('Too many attempts. Please try again in a little while.');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(err?.field_errors?.[0]?.messages?.[0] ?? 'Please check your details and try again.');
        return;
      }

      const { redirectUrl } = (await res.json()) as { redirectUrl: string };
      window.location.href = redirectUrl;
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="firstName" placeholder="First name" required minLength={2} maxLength={20} />
      <input name="lastName" placeholder="Last name" required minLength={2} maxLength={20} />
      <input name="companyName" placeholder="Company name" required minLength={3} maxLength={150} />
      <input name="email" placeholder="Work email" type="email" required />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Please wait…' : 'Next'}
      </button>
      {error && <p role="alert" style={{ color: '#c00' }}>{error}</p>}
    </form>
  );
}
```

### 3. Server-side call (recommended) — Next.js Route Handler

Keep the EPD call off the client. Your page POSTs to `/api/epd-signup`; this handler forwards to EPD
and returns `redirectUrl`.

```ts
// app/api/epd-signup/route.ts
import { NextRequest, NextResponse } from 'next/server';

const EPD_API_BASE = 'https://api-dev.dev1.epd.com';

export async function POST(req: NextRequest) {
  const body = await req.json();

  const res = await fetch(`${EPD_API_BASE}/auth/external-signup/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  // Pass EPD's status through so the client can branch on 400/429.
  return NextResponse.json(data, { status: res.status });
}
```

---

## Error handling checklist

| Situation                    | What you get                                             | What to do                                                                 |
| ---------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| Field invalid                | `400` + `field_errors[]`                                | Show `field_errors[0].messages[0]` (or map per field); keep user on form. |
| Rate limited                 | `429`                                                   | Show "try again later"; consider your own softer client-side throttle.    |
| Email already registered     | `200` + `alreadyRegistered: true` + login `redirectUrl` | Redirect to `redirectUrl` (login), optionally show "you already have an account". |
| New lead                     | `200` + `alreadyRegistered: false` + signup `redirectUrl` | Redirect to `redirectUrl`; an OTP email was sent.                        |
| Network / unexpected         | thrown / non-JSON                                       | Generic retry message.                                                     |

Both success branches do the same thing: **redirect to `redirectUrl`**. You only need to special-case
`alreadyRegistered` if you want to show a different message before redirecting.

---

## Notes & guarantees

- **The prefill only pre-fills form fields.** Account creation is still gated by the email OTP and the
  password the user sets on EPD — tampering with a prefill param can't create an account.
- **Fields stay editable** on EPD's password step; prefill is a convenience, not a lock.
- **Prefill params don't linger.** EPD's `/auth` page strips them from the URL as soon as it reads
  them, so they don't stick in browser history or leak via referrer on subsequent navigations.
- **No API key, no `/v1/*`.** This endpoint intentionally lives under `/auth` and is anonymous.
