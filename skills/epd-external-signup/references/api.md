# EPD External Signup API contract

Base URL: `https://api-dev.dev1.epd.com` (dev)

No auth header. No API key. This endpoint is anonymous by design: it exists to
create a merchant that does not have a key yet.

## The flow

```
Your page                      EPD backend                    EPD /auth page
---------                      -----------                    --------------
[first/last/company/email]
     |  Next >
     |  POST /v1/external-signup
     +---------------------------->
                                 validates the 4 fields
                                 if email already has an account
                                   -> returns a login URL, no OTP
                                 else
                                   -> emails a 6-digit OTP
                                   -> saves the lead server-side
                                   -> returns a redirect URL
                                      carrying only the email
     <----------------------------+
     |  { alreadyRegistered, redirectUrl }
     |
     |  send the browser to redirectUrl
     +------------------------------------------------------------>
                                                          reads email from URL
                                                          jumps to the OTP step
                                                          fetches name/company to
                                                            prefill the next step
                                                          user enters OTP, sets a
                                                            password
                                                          account created, logged in
```

Your only job: render the form, POST it, send the browser to `redirectUrl`.
EPD's `/auth` page owns everything after the redirect, including the prefill
lookup. You never call the prefill endpoint yourself.

## POST /v1/external-signup

Rate limited to **60 requests per hour per IP**. Over that returns `429`.

### Request body (JSON)

| Field | Required | Rules |
| --- | --- | --- |
| `email` | yes | valid email address |
| `firstName` | yes | 2-20 chars, letters, spaces, periods, hyphens, apostrophes, no HTML |
| `lastName` | yes | 2-20 chars, same character set as `firstName`, no HTML |
| `companyName` | yes | 3-150 chars, no HTML |
| `partnerKey` | no | string, max 100 chars, no HTML. See `partner-key.md` |
| `utmSource` | no | string, max 100 chars, no HTML |
| `utmMedium` | no | string, max 100 chars, no HTML |
| `utmCampaign` | no | string, max 100 chars, no HTML |
| `utmTerm` | no | string, max 100 chars, no HTML |
| `utmContent` | no | string, max 100 chars, no HTML |

The API rejects any property it does not recognize. Build the request body from
named fields. Never spread a whole `FormData` into it: a hidden input the host
page already had (its own `name="utm_campaign"` analytics field, for example)
would leak in as an unrecognized snake_case key and the request would 400.

Name and company rules mirror EPD's own signup form, so a value accepted here
also passes final account creation. No surprise rejection later.

### Known gaps in these rules

Confirm these with the backend team before a partner ships a page:

- **Character set is ambiguous.** "Letters" may mean ASCII `A-Za-z` or Unicode.
  If it is ASCII-only, every name with an accent or a non-Latin script is
  rejected. The templates use a permissive Unicode `pattern` in the browser and
  let the server be authoritative, so users see the server's message rather than
  a silent block.
- **`companyName` minimum of 3 rejects real companies.** "3M" and "BP" are two
  characters.

### Response - new lead

```json
{
  "alreadyRegistered": false,
  "redirectUrl": "https://app.epd.example/auth?externalSignup=1&email=ada%40example.com"
}
```

An OTP email is sent. Redirect the browser to `redirectUrl`.

### Response - email already has an account

```json
{
  "alreadyRegistered": true,
  "redirectUrl": "https://app.epd.example/auth?login=1&email=ada%40example.com"
}
```

No OTP is sent. Redirect the browser to `redirectUrl` and it lands on the login
screen with the email filled in. You may show your own "you already have an
account" message first.

> The `redirectUrl` values above are illustrative. The real host differs per
> environment. Never build this URL yourself. Always use the value returned.

### Success status code

**Unverified.** Earlier documentation claimed both `200` and `201` for these two
branches in different places. Until the backend team confirms, treat any 2xx as
success. Every template branches on `res.ok`, never on an exact status code, so
both are safe. `201 Created` for the `alreadyRegistered` branch would be wrong
regardless, since nothing is created.

### Response 400 - validation failed

Every error response, whatever its status, is wrapped in a top-level `error` object:

```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "validation_error",
    "message": "Validation failed for 2 fields. First name must be at least 2 characters.",
    "param": "firstName",
    "field_errors": [
      { "field": "firstName", "code": "invalid_value", "message": "First name must be at least 2 characters." },
      { "field": "email", "code": "invalid_value", "message": "Email must be an email." }
    ]
  }
}
```

Read `error.field_errors[]`, each with a single `message` string. There is no
top-level `field_errors` and no `messages` array.

- `field_errors` lists **every** failing property, not only the first one, and an
  unrecognized property (`"Property bogus should not exist."`) can come first.
  Show the first error whose `field` is one of the four inputs, and mark that input.
- `error.message` summarises all of them ("Validation failed for N fields. ...").
  Use it only when no error names a form field.
- `field_errors` is absent on non-validation errors. Fall back to `error.message`,
  then a generic message.

The templates do exactly this in `readError`.

### Response 429 - rate limited

More than 60 requests in an hour from that IP. Show a "try again shortly" message.
See `troubleshooting.md` for what this means when you call from a server.

### Response 5xx

Show a generic retry message. Do not retry automatically: the request may have
already created the lead and sent an OTP.

## Client-side or server-side

EPD's CORS reflects the calling origin, so a browser `fetch` works with no backend
change.

| | Client-side | Server-side |
| --- | --- | --- |
| Setup | just paste the form | needs a route handler |
| Rate limit applies to | each visitor's IP | **your server's single IP** |
| Partner key | unsafe, readable in page source | safe, never reaches the browser |
| Bot filtering | honeypot only | anything you want |

Use server-side whenever a partner key is involved. See `partner-key.md`.

The 60/hr per-IP limit is the trap in the server-side path: every visitor shares
your server's IP, so the whole site stops at 60 signups an hour. `assets/route.ts`
forwards the visitor's IP for this reason. Confirm the backend honours
`X-Forwarded-For` before relying on it, and add your own per-visitor throttle if
it does not.

## Notes

- **The lead is captured immediately.** EPD saves email, name, company, partner
  key, and UTM values as soon as the POST succeeds, even if the visitor never
  finishes the OTP step. That is why the redirect URL only carries the email.
- **Account creation is gated by the OTP and the password**, not by anything in
  the redirect URL. There is nothing in that URL to tamper with.
- **The email travels in the query string** of the redirect URL, so it lands in
  browser history and referrer headers. Acceptable for a first-touch flow, but
  worth knowing.
- **This endpoint reveals whether an email has an EPD account.** `alreadyRegistered`
  is returned to an anonymous caller, so it can be probed at 60 attempts an hour
  per IP. Raise this with the backend team if account enumeration matters to you.
