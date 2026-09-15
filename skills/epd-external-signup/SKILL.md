---
name: epd-external-signup
description: Generate a first-touch signup form (first name, last name, company, email) for an external site that posts to EPD's public signup API and redirects the visitor to EPD to finish with email OTP and password. Use when someone asks for an EPD signup form, EPD lead capture, a partner referral signup page, or wants to collect signups for EPD on their own domain.
license: MIT
---

# EPD External Signup

Generates a signup form that lives on the user's own domain. The form creates a lead
in EPD, then sends the visitor to EPD to finish account creation with email OTP and
a password.

Use this when the user wants a signup form on **their** site, not an embed of EPD's.

Do not use this for authenticated merchant API calls. Those need an API key and go
to other `/v1/*` endpoints. This endpoint is anonymous on purpose: the merchant does
not exist yet, so there is no key to send.

These instructions work in any coding agent (Claude, OpenAI Codex or ChatGPT, v0,
Replit Agent, Cursor, and others). Where a step depends on what your environment
can do, it says so.

## Steps

1. Ask the partner key question (Step 1).
2. Pick a template (Step 2).
3. Put that template in the user's project verbatim. Do not retype it from memory.
4. Change only the two things listed in Step 3.
5. Tell the user the base URL points at dev.

## Step 1 - Partner key

This is the first thing you ask. Ask it before generating anything, and ask it
even if the user did not mention partners.

> Are you registered as a partner with Easy Pay Direct?
>
> A partner key credits signup commission to you on every account this form creates.
>
> - **Yes** - paste your partner key.
> - **No** - you can register at https://emap.epd.dev/signup/partner.
> - **Skip** - I'll build the form without one. Everything works, and you can
>   add a key later.
>
> **Where to find your key:** log in to the partner portal at https://emap.epd.dev
> → **Integration** → **API Integration** → click **API Documentation**. Your key
> is shown as **API Key - Authorization: `<your key>`**. Copy just the key value
> and paste it here.

If your environment cannot pause to ask a question, treat the answer as **Skip**
and say so in your final message.

Then act on the answer:

| Answer | Do this |
| --- | --- |
| Pastes a key | Read `references/partner-key.md`. Use the server-side template (Step 2 row 1). Confirm the key is wired in |
| Registered, key not to hand | Give them the steps: log in at https://emap.epd.dev → **Integration** → **API Integration** → **API Documentation** → copy the value shown after **API Key - Authorization:**. Offer to build without it now and add it later |
| Not registered | Give them https://emap.epd.dev/signup/partner, and tell them that once registered the key is under **Integration** → **API Integration** → **API Documentation**. **Do not block on this.** Offer to build without it now and add it later |
| Skip, or no clear answer | Build without it. Change nothing in the template. This is the common case and is completely safe |

Never block the build waiting for a partner key. Registering takes time the user
may not want to spend right now, and the key can be added to a finished form in
one line later. See "Adding a key later" in `references/partner-key.md`.

Ask this once. If the user already answered it earlier in the conversation, do
not ask again.

Never put a partner key in a form field, a hidden input, or any file that reaches
the browser. It is a commission credential. Anyone who can read it can steal the
commission.

After generating, state plainly which happened:

- "Wired in partner key `<key>` server-side. It never reaches the browser."
- "Built without a partner key. To add one later, see `references/partner-key.md`."

## Step 2 - Pick a template

Check the rows in order. The first match wins.

| Situation | Copy |
| --- | --- |
| User gave a partner key | `assets/route.ts` **and** `assets/form.tsx` |
| React or Next.js, no partner key | `assets/form.tsx` |
| Plain HTML site, no build step | `assets/form.html` |
| Stack unclear | `assets/form.html` |

How to "copy" depends on your environment:

- **You can read the skill's files**: copy the file from `assets/` into the
  user's project.
- **You only have the skill as pasted or attached text**: reproduce the template
  exactly as provided. If the template was not provided, ask the user to paste it
  rather than writing your own.
- **You cannot write to the user's project**: output the file and tell the user
  the path to save it at.

`assets/form.tsx` posts to your own app by default. Change its `ENDPOINT` constant
to EPD's URL when there is no route handler. The file says where.

## Step 3 - What to change

Change only these two things:

1. `EPD_API_BASE` - leave the default unless the user named an environment.
2. Styling - the templates ship unstyled. Match the host page.

Do not change field names, `minlength`, `maxlength`, the honeypot field, or the
UTM block. Those match server-side validation and attribution. Changing them
causes 400s or lost attribution.

## Base URL

Default: `https://api-dev.dev1.epd.com`

Use it verbatim. Do not ask the user for it. Do not create or edit `.env` files.
Do not use `process.env` for it. If the user names a different environment,
change the single `EPD_API_BASE` constant and nothing else.

This is a dev endpoint. After generating, tell the user:
"This points at EPD dev. Change EPD_API_BASE before going live."

## UTM attribution

Already handled by every template. Do not ask the user about it.

Each template reads `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, and
`utm_content` from its own page URL and sends them with the signup. Real campaign
values win. `utm_source` and `utm_medium` fall back to `partner` and `skill_form`
when the URL has neither. The other three are omitted when absent.

Never make these form fields. Never write them back to the URL or browser history.

## Checking your work

If you can run Node, run this on each generated file:

```
node <path-to-this-skill>/scripts/verify.mjs <path-to-generated-file>
```

It checks field names, validation attributes, the UTM block, and that no partner
key leaked into client code. Fix anything it reports before telling the user you
are done.

If you cannot run commands, check these yourself instead:

- Inputs are named exactly `firstName`, `lastName`, `companyName`, `email`, and each has a label
- The honeypot input `name="website"` is still there
- The request body is built from named fields, never by spreading `FormData`
- All five `utm_*` params are read, with the `partner` and `skill_form` fallbacks
- The code checks `redirectUrl` exists before navigating to it
- No partner key appears in any file that reaches the browser
- `EPD_API_BASE` is a hardcoded `https://` string, not an env var

## More detail

Read these only when you need them:

- Request and response contract, validation rules, error shapes, rate limits ->
  `references/api.md`
- Partner key wiring and commission safety -> `references/partner-key.md`
- Form submits but nothing happens, CORS errors, 400s -> `references/troubleshooting.md`
