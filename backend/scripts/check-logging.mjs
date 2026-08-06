#!/usr/bin/env node
// Static guardrail against secret logging (KAN-99 / KAN-128).
//
// Fails the build if source introduces an obvious dangerous logging pattern,
// e.g. logging raw environment variables or interpolating secrets/credentials
// into a log call. This complements the runtime pino redaction in
// src/utils/logger.js: redaction protects objects we log, while this check
// catches string-interpolation leaks that bypass redaction.
//
// Tuning: the scan is limited to logging statements inside backend/src and
// skips the redaction config itself, so the secret field names that are
// legitimately listed there (and in .env.example / docs) do not trip it.
//
// Known limitation: the log call and the forbidden pattern must appear on
// the SAME line — a multi-line logger call (arguments on following lines)
// evades this check. It is a guardrail against the obvious cases, not a
// substitute for the runtime redaction or code review.

import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '..', 'src');

// Files allowed to mention secret field names (the redaction allowlist).
const IGNORED_FILES = new Set([join(SRC_DIR, 'utils', 'logger.js')]);

// Any logging call: console.* / logger.* / req.log.* / res.log.*
const LOG_CALL = /(?:console|logger|req\.log|res\.log)\s*\.\s*(?:log|error|warn|info|debug|trace|fatal)\s*\(/;

// Patterns that must never appear inside a logging call.
const FORBIDDEN = [
  { re: /process\.env\b/, label: 'logs a raw environment variable (process.env.*)' },
  { re: /\bpasswordHash\b/, label: 'logs a password hash (passwordHash)' },
  { re: /\bexecCode\b/, label: 'logs an executive code (execCode)' },
  { re: /process\.env\.SMTP_PASS\b/, label: 'logs SMTP_PASS' },
  { re: /process\.env\.DATABASE_URL\b/, label: 'logs DATABASE_URL' },
  { re: /process\.env\.JWT_SECRET\b/, label: 'logs JWT_SECRET' },
];

function listJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listJsFiles(full));
    } else if (full.endsWith('.js') || full.endsWith('.mjs')) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];

for (const file of listJsFiles(SRC_DIR)) {
  if (IGNORED_FILES.has(file)) continue;

  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (!LOG_CALL.test(line)) return;
    for (const { re, label } of FORBIDDEN) {
      if (re.test(line)) {
        violations.push({
          file: relative(process.cwd(), file),
          line: idx + 1,
          label,
          text: line.trim(),
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error('\n✖ Dangerous logging patterns detected:\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} — ${v.label}`);
    console.error(`    ${v.text}\n`);
  }
  console.error(`Found ${violations.length} violation(s). Route secrets through the redacting logger instead.`);
  process.exit(1);
}

console.log('✔ No dangerous logging patterns found.');
