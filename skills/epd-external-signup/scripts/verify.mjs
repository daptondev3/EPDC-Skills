#!/usr/bin/env node
/**
 * Verifies a generated EPD signup file.
 *
 * Usage: node verify.mjs <path> [<path> ...]
 *
 * Exits 0 if everything passes, 1 if anything failed.
 * Run this after copying a template, before telling the user you are done.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const REQUIRED_FIELDS = ['firstName', 'lastName', 'companyName', 'email'];

const ROUTE_PATHS = [
  'app/api/epd-signup/route.ts',
  'app/api/epd-signup/route.js',
  'src/app/api/epd-signup/route.ts',
  'src/app/api/epd-signup/route.js',
  'pages/api/epd-signup.ts',
  'pages/api/epd-signup.js',
  'src/pages/api/epd-signup.ts',
  'src/pages/api/epd-signup.js',
];

// A route handler counts if it was passed in alongside the form, or sits at a
// standard Next.js path in the form's directory or any parent of it.
function hasRouteHandler(file) {
  const passedIn = files.some((f) => {
    try {
      return /from ['"]next\/server['"]/.test(readFileSync(f, 'utf8'));
    } catch {
      return false;
    }
  });
  if (passedIn) return true;

  let dir = dirname(resolve(file));
  while (true) {
    if (ROUTE_PATHS.some((p) => existsSync(join(dir, p)))) return true;
    const parent = dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

const checks = [
  {
    name: 'required field names present',
    applies: (src) => /<(form|input)/i.test(src),
    run: (src) => {
      const missing = REQUIRED_FIELDS.filter(
        (f) => !new RegExp(`name=["']${f}["']`).test(src)
      );
      return missing.length ? `missing field(s): ${missing.join(', ')}` : null;
    },
  },
  {
    name: 'every input has a label',
    applies: (src) => /<input/i.test(src),
    run: (src) => {
      const ids = [...src.matchAll(/<input[^>]*\sid=["']([^"']+)["']/gi)].map((m) => m[1]);
      const unlabelled = ids.filter(
        (id) => !new RegExp(`(for|htmlFor)=["']${id}["']`).test(src)
      );
      return unlabelled.length ? `no label for: ${unlabelled.join(', ')}` : null;
    },
  },
  {
    name: 'honeypot field present',
    applies: (src) => /<form/i.test(src),
    run: (src) => (/name=["']website["']/.test(src) ? null : 'honeypot field was removed'),
  },
  {
    name: 'no raw FormData spread into the request body',
    applies: () => true,
    run: (src) =>
      /\.\.\.Object\.fromEntries\s*\(\s*(new\s+)?FormData|\.\.\.formData/i.test(src)
        ? 'spreading FormData leaks unrecognized keys and causes a 400'
        : null,
  },
  {
    // Client-side files read the five params off the page URL.
    name: 'UTM block reads the page URL',
    applies: (src) => /URLSearchParams/.test(src),
    run: (src) => {
      const missing = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content',
      ].filter((t) => !src.includes(t));
      return missing.length ? `UTM block edited, missing: ${missing.join(', ')}` : null;
    },
  },
  {
    // Nothing is invented: a UTM value is forwarded only when the URL carried it.
    name: 'UTM values are sent only when present',
    applies: (src) => /utm(Source|Medium|Campaign|Term|Content)/.test(src),
    run: (src) => {
      const missing = [
        'utmSource',
        'utmMedium',
        'utmCampaign',
        'utmTerm',
        'utmContent',
      ].filter((k) => !src.includes(k));
      if (missing.length) return `UTM block edited, missing: ${missing.join(', ')}`;

      // Any non-empty literal defaulted onto a UTM line invents attribution.
      // `|| ''` is fine: that is the "no value" case.
      const hardcoded = src
        .split('\n')
        .find((line) => /utm/i.test(line) && /(\|\||\?\?)\s*['"][^'"]+['"]/.test(line));
      return hardcoded
        ? `hardcoded UTM fallback: ${hardcoded.trim()} - send nothing when the URL has no value`
        : null;
    },
  },
  {
    name: 'UTM values are never written back to the URL',
    applies: () => true,
    run: (src) =>
      /history\.(replaceState|pushState)/.test(src)
        ? 'UTM reads are read-only; do not rewrite the URL or history'
        : null,
  },
  {
    name: 'redirectUrl is guarded before navigating',
    applies: (src) => src.includes('redirectUrl'),
    run: (src) =>
      /(!data\??\.?redirectUrl|!data \|\| !data\.redirectUrl|redirectUrl\s*\?)/.test(src)
        ? null
        : 'navigating to redirectUrl without checking it exists',
  },
  {
    // form.tsx ships posting to its own route handler. Copied without route.ts,
    // every submit 404s.
    name: 'ENDPOINT has a route handler behind it',
    applies: (src) => /const ENDPOINT\s*=\s*['"]\/api\/epd-signup['"]/.test(src),
    run: (src, file) =>
      hasRouteHandler(file)
        ? null
        : "ENDPOINT is '/api/epd-signup' but no route handler was found. Copy assets/route.ts " +
          'to app/api/epd-signup/route.ts, or set ENDPOINT to `${EPD_API_BASE}/v1/external-signup`',
  },
  {
    // EPD returns { error: { field_errors: [{ field, message }] } }. Reading a
    // top-level field_errors or messages[0] silently shows only the generic error.
    name: 'reads EPD error shape',
    applies: (src) => /!res\.ok/.test(src),
    run: (src) => {
      if (/\.messages\??\.?\[0\]/.test(src)) {
        return 'reads field_errors[].messages[0]; EPD sends a single `message` per field error';
      }
      if (/data\s*(\?\.|&&\s*data\.|\.)\s*field_errors/.test(src)) {
        return 'reads a top-level field_errors; EPD nests it under `error`';
      }
      return /field_errors/.test(src)
        ? null
        : 'does not read error.field_errors, so visitors never see which field was rejected';
    },
  },
  {
    name: 'no partner key in client-side code',
    applies: (src) => !/from ['"]next\/server['"]/.test(src),
    run: (src) =>
      /partnerKey\s*[:=]\s*['"`]/.test(src)
        ? 'partner key found in a file that reaches the browser - move it to route.ts'
        : null,
  },
  {
    name: 'partner key is not a form field',
    applies: () => true,
    run: (src) =>
      /name=["']partnerKey["']/.test(src)
        ? 'partnerKey must never be an input, hidden or otherwise'
        : null,
  },
  {
    name: 'base URL points somewhere real',
    applies: (src) => src.includes('EPD_API_BASE'),
    run: (src) =>
      /EPD_API_BASE\s*=\s*['"]https:\/\/[^'"]+['"]/.test(src)
        ? null
        : 'EPD_API_BASE is missing or not an https URL',
  },
  {
    name: 'no env plumbing for the base URL',
    applies: () => true,
    run: (src) =>
      /process\.env\.[A-Z_]*(API_BASE|BASE_URL|EPD_URL)/.test(src)
        ? 'the base URL is hardcoded by design, not an env var'
        : null,
  },
];

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error('usage: node verify.mjs <path> [<path> ...]');
  process.exit(1);
}

let failed = 0;

for (const file of files) {
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    console.error(`FAIL ${file}: cannot read file`);
    failed++;
    continue;
  }

  const problems = [];
  for (const check of checks) {
    if (!check.applies(src)) continue;
    const problem = check.run(src, file);
    if (problem) problems.push(`${check.name}: ${problem}`);
  }

  if (problems.length === 0) {
    console.log(`PASS ${file}`);
  } else {
    failed++;
    console.error(`FAIL ${file}`);
    for (const problem of problems) console.error(`  - ${problem}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} file(s) failed. Fix these before reporting done.`);
  process.exit(1);
}

console.log('\nAll checks passed.');
