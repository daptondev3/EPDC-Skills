# EPD External Signup

An [Agent Skill](https://agentskills.io) that scaffolds a first-touch signup form for an **external page
you control** — a blog, partner landing page, or marketing microsite — and wires it up to EPD's public
`POST /v1/external-signup` endpoint.

## What it does

The form collects **first name, last name, company name, and email**, then hands the visitor off to EPD
to finish creating their account with email OTP + password. The visitor never re-types their name or
company on EPD — those fields carry across on the redirect. Point your agent at [`SKILL.md`](SKILL.md)
and it generates a ready-to-paste HTML or React form, or a Next.js server route, with no config file to
write and no API key to obtain — the endpoint is deliberately anonymous because the whole point of
calling it is to create a merchant that doesn't have one yet. Every generated form also reads UTM
attribution (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`) straight off the
visitor's own page URL at submit time and forwards it to EPD — real campaign data wins over the
skill's own fallback values whenever it's present.

## When to use it

- You want a signup form living on **your own domain**.
- Example prompts: *"Build a signup form for our landing page using the EPD external signup skill"*,
  *"Add an EPD lead-capture form to this Next.js page"*, *"Wire up first-touch signup with an email OTP
  hand-off to EPD."*

## Install

**Option A — clone into your agent's skills directory**

Most agent CLIs/IDEs that support this skill format look for skills in a local directory (e.g. a
`skills/` folder they watch). Clone this repo in as one:

```bash
git clone https://github.com/daptondev3/EPDC-Skills.git <your-agent's-skills-directory>/epd-external-signup
```

Restart or reload your agent and the skill loads automatically.

**Option B — `npx skills`**

```bash
npx skills add daptondev3/EPDC-Skills
```

**Option C — no install, just point your agent at the file**

Clone or download this repo, then tell your agent:

```
Build the signup form using this specification: SKILL.md
```

## Usage

1. Ask your agent to build the form (see example prompts above).
2. It stops once and asks the gate question below — answer it, and generation proceeds.
3. You get back a self-contained template (HTML+JS, React, or a Next.js route handler) already pointed
   at EPD's backend, ready to paste with nothing left to configure.

### The gate question

Before generating anything, the skill asks:

> Do you have a partner/referral key for this integration?

Most integrations don't — if you're not sure, say no and `partnerKey` is omitted entirely. When you do
have one, the skill hardcodes it into the request payload in code; it is **never** a form field the
visitor can see, type into, or inspect. See
[`SKILL.md`](SKILL.md#before-generating-anything-ask-about-partnerkey) for the full rationale.

## Example output

The plain HTML/JS template the skill hands back looks like this (trimmed):

```html
<form id="epd-signup">
  <input name="firstName"   placeholder="First name"   required minlength="2"  maxlength="20" />
  <input name="lastName"    placeholder="Last name"    required minlength="2"  maxlength="20" />
  <input name="companyName" placeholder="Company name" required minlength="3"  maxlength="150" />
  <input name="email"       placeholder="Work email"   required type="email" />
  <button type="submit">Next</button>
</form>
```

```js
const body = Object.fromEntries(new FormData(form).entries());
// utm_source/utm_medium come from the visitor's own URL when present, else fall back to
// this skill's defaults; utm_campaign/utm_term/utm_content are only added when present.
const params = new URLSearchParams(window.location.search);
body.utmSource = params.get('utm_source') || 'partner';
body.utmMedium = params.get('utm_medium') || 'skill_form';

const res = await fetch(`${EPD_API_BASE}/v1/external-signup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const { redirectUrl } = await res.json();
window.location.href = redirectUrl; // EPD's /auth page takes it from here (OTP → password → account)
```

The full versions (with error handling, `partnerKey` injection, the full 5-field UTM pass-through,
React, and a server-side Next.js route handler) are in
[`SKILL.md`](SKILL.md#ready-to-paste-templates).

## What's inside `SKILL.md`

- The `POST /v1/external-signup` API contract — request/response shapes, field validation rules, rate limits
- The full first-touch → EPD hand-off flow (OTP, prefill, account creation)
- Ready-to-paste templates: plain HTML + vanilla JS, React/Next.js, and a Next.js server-side route handler
- Guidance on calling the endpoint client-side vs. server-side (CORS is already open on EPD's side)
- An error-handling checklist (validation errors, rate limiting, already-registered emails)

## What's included

```
EPDC-Skills/
├── README.md    this file
└── SKILL.md     the skill — entry point for your agent (frontmatter: name, description)
```

No `references/`, `scripts/`, or `assets/` directories — the whole skill lives in the one file, and the
templates it generates are self-contained (no separate config).
