# EPDC Skills

This skill is for anyone who wants a signup form on a page **they control** - a blog,
partner landing page, or marketing microsite, that captures leads for EPD Commerce. Give it to your AI agent and it builds a first-touch signup form
(first name, last name, company, email) that creates a lead in EasyPayDirect, then hands the
visitor to EPD Commerce to finish account creation with email OTP and a password. Registered
EasyPayDirect partners can wire in their partner key so every signup the form drives is
attributed to them for commission.

Every generated form also forwards UTM attribution (`utm_source`, `utm_medium`,
`utm_campaign`, `utm_term`, `utm_content`) read from the visitor's own page URL.

## Installation

**What you'll need**

- **A partner API key (optional)**, from the [EasyPayDirect partner portal](https://emap.epd.dev/signup/partner).
  It's what attributes signups to you for commission.
- **An AI coding assistant** (Claude Code, Cursor, OpenAI Codex, etc.). This is what
  actually builds the form from the skill. App builders like v0 or Replit work too,
  as long as you can give them the `SKILL.md` contents to build from.
- **Node.js**, only for the `npx` install method below; not needed if you copy the
  skill manually. Get it at [nodejs.org](https://nodejs.org).

> Not comfortable with a terminal? You can skip the commands entirely. Open your AI
> assistant, give it the skill (paste the link to `SKILL.md`), and ask it to build
> the form for you.

**1. Get the skill**

*Option A: `npx skills` (recommended)*

> **Before you run this, you need Node.js installed.** It's what provides the `npx`
> command. Download it from [nodejs.org](https://nodejs.org) (pick the "LTS" version
> and click through the installer), then reopen your terminal. To check it worked,
> run `node --version`; if it prints a version number you're set. If `npx` still
> isn't found after installing, close and reopen the terminal.

```bash
npx skills add daptondev3/EPDC-Skills
```

*Option B: download it (no terminal needed)*

1. Click the green **Code** button -> **Download ZIP**, then unzip it.
2. The skill is the `skills/epd-external-signup` folder inside. Point your agent at
   it (next step), or drop that folder wherever your agent reads skills from.

**2. Point your agent at it**

Tell your AI assistant to build the form from `SKILL.md`. A few examples:

*Claude:*
```
Build the signup form using this specification: skills/epd-external-signup/SKILL.md
```

*OpenAI Codex:*
```
Build the signup form using this specification: skills/epd-external-signup/SKILL.md
```

*Any other agent:*
```
Generate the signup form described in skills/epd-external-signup/SKILL.md.
```

It asks one question first - whether you're registered as an Easy Pay Direct
partner - then copies a template into your project, already pointed at EPD's
backend.

## The Partner Key

A partner key credits signup commission to you on every account the form creates.
It is optional. The skill asks about it first, and there are three ways to answer:

| You are | What happens |
| --- | --- |
| A registered Easy Pay Direct partner | Paste your key and it gets wired in server-side. To find it: log in at https://emap.epd.dev → **Integration** → **API Integration** → **API Documentation** → copy the value shown after **API Key - Authorization:** |
| Not registered | You get a link to register at https://emap.epd.dev/signup/partner - but the build does not wait for you |
| Not interested | Skip it. The form works exactly the same, no commission is credited |

Skipping is safe and reversible. You can add a key to a finished form later; see
[`references/partner-key.md`](skills/epd-external-signup/references/partner-key.md#adding-a-key-later)
for how much work that is on each template.

If you do provide a key, **the skill uses the server-side template**. That is not
a preference. The API has no signature or origin check on the key, so anyone who
can view-source a page containing it can farm signups against your commission
account. The server-side route keeps it out of the browser entirely.

## Folder Structure

```
skills/epd-external-signup/
├── SKILL.md                     entry point - decisions and routing only
├── references/                  the agent reads these on demand
│   ├── api.md                   request/response contract, validation, rate limits
│   ├── partner-key.md           commission wiring and why it must stay server-side
│   └── troubleshooting.md       symptom -> cause -> fix
├── assets/                      the agent copies these; it does not retype them
│   ├── form.html                plain HTML + vanilla JS, no build step
│   ├── form.tsx                 React / Next.js client component
│   └── route.ts                 Next.js route handler (required for partner keys)
└── scripts/
    └── verify.mjs               checks a generated file before you ship it
```

The split is deliberate. `SKILL.md` holds only what the agent needs to *decide* what
to do, so it stays cheap to load. `references/` holds detail pulled in on demand.
`assets/` holds complete working files that get **copied**, not regenerated from a
code block in a prompt - which is what keeps the generated form byte-correct
regardless of which model is driving.

## Current Skills

| Skill | Entry point |
| --- | --- |
| EPD External Signup | [`skills/epd-external-signup/SKILL.md`](skills/epd-external-signup/SKILL.md) |
