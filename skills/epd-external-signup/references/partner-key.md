# Partner key

A partner key credits signup commission to a partner. It is a **payment
credential**, and the API has no signature, origin check, or any other binding
on it. Whoever holds the string collects the commission.

## Getting a key

| Situation | Where to point them |
| --- | --- |
| Registered as an Easy Pay Direct partner | Their partner account at https://emap.epd.dev |
| Not registered | https://emap.epd.dev/signup/partner |

Registering is not instant and the user may not want to do it mid-task. Never
hold the build hostage to it. Build the form without a key, hand it over, and
tell them how to add one later.

## The rule

A partner key must never reach the browser.

That means it cannot go in:

- a form field, visible or hidden
- a `data-` attribute
- client-side JavaScript, even as a constant
- a `NEXT_PUBLIC_*` variable
- anything else a visitor can view-source or read in devtools

If it reaches the browser, anyone can lift it from a partner's landing page and
farm signups against their commission account.

## What this means for template choice

A partner key forces the server-side template. Copy both:

- `assets/route.ts` - the route handler that injects the key
- `assets/form.tsx` - the form, posting to that route

There is no client-only option when a partner key is in play. Templates 1 and 2
alone cannot hold the key safely.

## Wiring it in

In `assets/route.ts`, find this line:

```ts
// PARTNER KEY: uncomment and set the partner's key to enable commission credit.
// body.partnerKey = 'REPLACE_WITH_PARTNER_KEY';
```

Uncomment it and replace the placeholder with the partner's actual key.

The key is injected after the request body is rebuilt from the whitelist, so a
client cannot override or inject one of their own.

Better still, read it from a server-only environment variable so the key is not
committed to the partner's repo:

```ts
body.partnerKey = process.env.EPD_PARTNER_KEY;
```

This is the one place an environment variable is appropriate in this skill. It
is server-only and it is a secret. The base URL is neither.

## After wiring it

Tell the user explicitly which of these happened:

- "Wired in partner key `<key>` server-side. It never reaches the browser."
- "No partner key, omitted."

Do not leave it ambiguous. A silently missing key means uncredited commission
that nobody notices until a payout is short.

## If they have no key yet

Omit `partnerKey` entirely. Do not add the field anywhere. Do not leave a
commented-out placeholder in a client-side file. Every template works unchanged
without it, and this is the common case.

Then tell them the form is complete and a key can be added later.

## Adding a key later

How much work this is depends on which template they already have.

**They already have `route.ts`** (server-side). One line. Uncomment the partner
key line in the route handler and set the key. Nothing else changes, and the
form itself is untouched.

**They only have `form.html` or `form.tsx`** (client-side). The key cannot go in
either file, so this is a migration, not a one-line edit:

1. Add `assets/route.ts` to their project at `app/api/epd-signup/route.ts`.
2. Wire the key into that route handler.
3. Point the form at it:
   - `form.tsx` - set `ENDPOINT` to `'/api/epd-signup'`.
   - `form.html` - change the `fetch` URL from `EPD_API_BASE + '/v1/external-signup'`
     to `'/api/epd-signup'`. This only works if the page is served by an app that
     can host a route handler. A static site cannot, and needs a serverless
     function or a small backend instead.
4. Re-run `scripts/verify.mjs` on both files.

Say this up front when someone is mid-registration and choosing a template. If
they are likely to get a key soon and their stack can host a route handler,
starting from `route.ts` + `form.tsx` saves them the migration.

## What the key does

Pure pass-through attribution. EPD has no partner concept of its own, it just
stores the string. Sending it:

- saves it with the lead as soon as the POST succeeds, so the partner is credited
  even if the visitor never finishes OTP and password
- does not ride on the `redirectUrl`
- does not change the OTP step, the gating logic, or which redirect branch comes back

Omitting it is completely safe.
