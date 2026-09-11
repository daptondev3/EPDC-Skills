# Troubleshooting

## The form submits and nothing happens

Check the browser console and network tab first.

| Symptom | Cause | Fix |
| --- | --- | --- |
| No network request at all | The submit handler never ran, or a validation attribute is blocking | Confirm the form's `id` matches the one the script looks up. Check for a JS error earlier on the page |
| Request fires, page does not move | `redirectUrl` missing from the response | The templates guard against this and show an error. Check the response body |
| Navigates to `undefined` | An older template without the `redirectUrl` guard | Recopy the template from `assets/` |

## 400 on every submit

| Cause | Fix |
| --- | --- |
| An extra property in the body | The API whitelists properties. Build the body from named fields, never spread a whole `FormData`. If the host page's form has its own hidden inputs, a spread leaks them in |
| Field names were renamed | They must be exactly `firstName`, `lastName`, `companyName`, `email` |
| A value is empty or whitespace | The templates trim before sending. If you edited that out, `"  "` passes the browser's `minlength` and fails server-side |
| A `utm*` value over 100 chars | The templates truncate to 100. Do not remove that |
| A name with an accent or non-Latin script | The server character set is ambiguous. See "Known gaps" in `api.md` and confirm with the backend team |
| Company name under 3 chars | `companyName` has a 3-character minimum. "3M" is rejected. Known gap, see `api.md` |

Read the actual message from `field_errors[0].messages[0]` rather than guessing.

## 429 after very few signups

Expected if you are calling from a server. The limit is 60 requests per hour per
IP, and every visitor shares your server's IP, so the whole site stops at 60 an
hour.

`assets/route.ts` forwards the visitor's IP in `X-Forwarded-For` to avoid this.
Confirm the backend honours that header. If it does not, add your own per-visitor
throttle and ask the backend team to raise the limit for your server's IP.

Client-side templates do not have this problem. The limit applies per visitor,
which is usually what you want. Note that visitors behind corporate NAT or a
mobile carrier share an IP and can exhaust it for each other.

## CORS error in the console

EPD reflects the calling origin, so this should not happen. If it does:

- The `Content-Type: application/json` header makes this a preflighted request.
  Confirm the backend answers `OPTIONS /v1/external-signup`.
- Check you are calling the right host. A typo in `EPD_API_BASE` produces a CORS
  error rather than a 404, because the failure happens before the response.
- If it persists, switch to `assets/route.ts`. A server-to-server call has no CORS.

## Redirected to EPD but the name and company are blank

EPD's `/auth` page fetches those itself after the redirect. You do not pass them.
If they are blank, the lead was not saved, or the prefill lookup failed on EPD's
side. Report it to the backend team with the email address used.

## OTP email never arrives

- Check whether the response had `alreadyRegistered: true`. That branch sends no
  OTP by design and redirects to login instead.
- Otherwise it is an EPD-side delivery issue. The POST succeeding means the lead
  was saved.

## Everything works in dev, nothing works in production

`EPD_API_BASE` still points at `https://api-dev.dev1.epd.com`. That is the
default in every template. Change that one constant.
