# EPDC Skills

Agent Skills for integrating with EPD.

| Skill | What it does |
| --- | --- |
| [`epd-external-signup`](skills/epd-external-signup) | Generates a first-touch signup form for an external site, wired to EPD's public signup API |

## epd-external-signup

Scaffolds a signup form for a page **you control** - a blog, partner landing page,
or marketing microsite. The form collects first name, last name, company name, and
email, creates a lead in EPD, then hands the visitor to EPD to finish with email OTP
and a password. They never re-type their name or company.

No API key, no config file. The endpoint is anonymous on purpose: the whole point of
calling it is to create a merchant who does not have a key yet.

Every generated form also forwards UTM attribution (`utm_source`, `utm_medium`,
`utm_campaign`, `utm_term`, `utm_content`) read from the visitor's own page URL.

### Install

**Option A - `npx skills`**

```bash
npx skills add daptondev3/EPDC-Skills
```

**Option B - clone into your agent's skills directory**

```bash
git clone https://github.com/daptondev3/EPDC-Skills.git /tmp/epdc-skills
cp -r /tmp/epdc-skills/skills/epd-external-signup <your-agent's-skills-directory>/
```

For example:

```bash
# Claude Code - this project only
cp -r /tmp/epdc-skills/skills/epd-external-signup .claude/skills/


# OpenAI Codex - this project only
cp -r /tmp/epdc-skills/skills/epd-external-signup .agents/skills/
```


Create the skills directory first (`mkdir -p`) if it does not exist yet.

The directory name must stay `epd-external-signup` to match the skill's frontmatter.

**Option C - no install**

Clone the repo and point your agent at the file:

```
Build the signup form using this specification: skills/epd-external-signup/SKILL.md
```

### Usage

Ask your agent for the form:

- *"Build a signup form for our landing page using the EPD external signup skill"*
- *"Add an EPD lead-capture form to this Next.js page"*
- *"Wire up first-touch signup with an email OTP hand-off to EPD"*

It asks one question first - whether you're registered as an Easy Pay Direct
partner - then copies a template into your project, already pointed at EPD's
backend.

### The partner key

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

### Layout

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

### Verifying generated code

```bash
node skills/epd-external-signup/scripts/verify.mjs path/to/your/form.tsx
```

Checks field names, labels, the honeypot, the UTM block, the `redirectUrl` guard,
and that no partner key leaked into client-side code. Exits non-zero on failure, so
it drops straight into CI.

### Before going live

Two sets of URLs in this skill point at dev environments:

| | Currently | Used by |
| --- | --- | --- |
| API base | `https://api-dev.dev1.epd.com` | `EPD_API_BASE` in every template |
| Partner portal | `https://emap.epd.dev` | where partners register and find their key |

The skill hardcodes these rather than reading config, so the templates stay
copy-paste correct for any agent. The trade-off is that going live means
rewriting them in several files. One command does it:

```bash
# See what is in use and where
node skills/epd-external-signup/scripts/set-environment.mjs

# Rewrite everything at once
node skills/epd-external-signup/scripts/set-environment.mjs \
  --api-base=https://api.example.com \
  --portal=https://portal.example.com
```

Add the check to CI so a dev host cannot ship silently:

```bash
node skills/epd-external-signup/scripts/set-environment.mjs --check
```

It exits non-zero while any dev host remains. This matters most for the partner
portal link: a wrong API base fails loudly, but a partner who registers in the
wrong environment just quietly never gets paid.
