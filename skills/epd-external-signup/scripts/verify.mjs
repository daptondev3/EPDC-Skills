#!/usr/bin/env node
/**
 * Verifies a generated EPD signup file.
 *
 * Usage: node verify.mjs <path> [<path> ...]
 *
 * Exits 0 if everything passes, 1 if anything failed.
 * Run this after copying a template, before telling the user you are done.
 */

import { readFileSync } from 'node:fs';

const REQUIRED_FIELDS = ['firstName', 'lastName', 'companyName', 'email'];

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
    // Every file that calls EPD must send source and medium, however it got them.
    name: 'UTM source and medium have fallbacks',
    applies: (src) => src.includes('utmSource') || src.includes('utmMedium'),
    run: (src) => {
      if (!src.includes('utmSource') || !src.includes('utmMedium')) {
        return 'utmSource and utmMedium must both be sent';
      }
      const missing = ['partner', 'skill_form'].filter((t) => !src.includes(t));
      return missing.length ? `fallback value(s) removed: ${missing.join(', ')}` : null;
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
    const problem = check.run(src);
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
