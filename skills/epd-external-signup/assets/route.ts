/**
 * EPD external signup - Next.js route handler (App Router).
 *
 * Save as: app/api/epd-signup/route.ts
 * Pair with: assets/form.tsx (its ENDPOINT already points here)
 *
 * Required when a partner key is in play. The key is injected here and never
 * reaches the browser. See references/partner-key.md.
 *
 * Change only EPD_API_BASE, and the partner key line if you have one.
 */

import { NextRequest, NextResponse } from 'next/server';

const EPD_API_BASE = 'https://api-dev.dev1.epd.com';

const TIMEOUT_MS = 10_000;
const MAX_UTM_LENGTH = 100;

function str(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export async function POST(req: NextRequest) {
  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Malformed request body.' },
      { status: 400 }
    );
  }

  // Rebuild the body from a whitelist. Never forward the client's object as-is:
  // the API rejects unrecognized properties, and a client must not be able to
  // inject a partnerKey of its own.
  const body: Record<string, string> = {
    firstName: str(raw.firstName, 20),
    lastName: str(raw.lastName, 20),
    companyName: str(raw.companyName, 150),
    email: str(raw.email, 254),
  };

  // UTM attribution. The visitor's page URL lives in the browser, not here, so
  // the client resolved these already. Fall back only as a safety net.
  body.utmSource = str(raw.utmSource, MAX_UTM_LENGTH) || 'partner';
  body.utmMedium = str(raw.utmMedium, MAX_UTM_LENGTH) || 'skill_form';
  for (const key of ['utmCampaign', 'utmTerm', 'utmContent'] as const) {
    const value = str(raw[key], MAX_UTM_LENGTH);
    if (value) body[key] = value;
  }

  // PARTNER KEY: uncomment and set the partner's key to enable commission credit.
  // Prefer a server-only env var so it stays out of the repo.
  // body.partnerKey = 'REPLACE_WITH_PARTNER_KEY';

  // EPD rate limits 60 requests per hour per IP. Without this header every
  // visitor shares your server's single IP and the whole site stops at 60 an
  // hour. Confirm the backend honours it; if it does not, add your own
  // per-visitor throttle here.
  const visitorIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${EPD_API_BASE}/v1/external-signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(visitorIp ? { 'X-Forwarded-For': visitorIp } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => null);

    // Pass EPD's status through so the client can branch on 400 and 429.
    return NextResponse.json(data ?? { success: res.ok }, { status: res.status });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return NextResponse.json(
      {
        success: false,
        message: timedOut
          ? 'Signup service timed out. Please try again.'
          : 'Signup service is unavailable. Please try again.',
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
