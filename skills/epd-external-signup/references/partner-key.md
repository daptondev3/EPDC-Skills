# Partner key

A partner key credits signups to a partner. It is not a secret: it identifies the
partner, the same way a referral code does, so it is fine in page source.

## Getting a key

| Situation | Where to point them |
| --- | --- |
| Registered as an Easy Pay Direct partner | Log in at https://emap.epd.dev → **Integration** → **API Integration** → **API Documentation** → copy the value shown after **API Key - Authorization:** |
| Not registered | Register at https://emap.epd.dev/signup/partner, then follow the same steps |

The portal labels the key "API Key - Authorization". Use only the key value as
the partner key. Do not include the label or the word "Authorization", and do not
send it as an `Authorization` header.

Registering is not instant and the user may not want to do it mid-task. Never
hold the build hostage to it. Build the form without a key, hand it over, and
tell them how to add one later.

## Wiring it in

Every form template has this constant near the top of its script:

```js
const PARTNER_KEY = '';
```

Put the key in it as a plain string:

```js
const PARTNER_KEY = 'the-partner-key';
```

That is the whole change, in `form.html` and `form.tsx` alike. The form sends it as
`partnerKey` with every signup. `route.ts`, if used, forwards it unchanged and
needs no edit.

Do not:

- read it from an environment variable. A variable that is missing, or not
  exposed to the browser, is `undefined` at runtime and the key is silently dropped.
- add it as a form field, hidden or visible. The request body is built from named
  fields only, so the field would never be sent.
- leave the portal label in the value. `verify.mjs` flags a value with spaces,
  colons, or "Authorization" in it.

## After wiring it

Tell the user explicitly which of these happened:

- "Added your partner key `<key>` to the form. Every signup it sends is credited to you."
- "Built without a partner key. To add one later, set `PARTNER_KEY` in the form."

Do not leave it ambiguous. A silently missing key means uncredited commission
that nobody notices until a payout is short.

## If they have no key yet

Leave `PARTNER_KEY` as `''`. The form sends no `partnerKey` at all. Every template
works unchanged without it, and this is the common case.

Then tell them the form is complete and a key can be added later.

## Adding a key later

Set `PARTNER_KEY` in the form they already have and republish the page. Nothing
else changes, whatever the site is built with.

Signups sent before the key was added are not credited.

## What the key does

Pure pass-through attribution. The signup endpoint does not check the key, it
stores the string with the lead. Sending it:

- saves it with the lead as soon as the POST succeeds, so the partner is credited
  even if the visitor never finishes OTP and password
- does not ride on the `redirectUrl`
- does not change the OTP step, the gating logic, or which redirect branch comes back

Because nothing checks it, a mistyped key is accepted and credits nobody. Copy it
exactly.

Omitting it is completely safe.
