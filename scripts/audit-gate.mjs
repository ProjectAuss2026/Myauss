// KAN-101: CI dependency audit gate.
//
// Wraps `npm audit --json` so that CI can fail on high/critical vulnerabilities
// while still allowing a small number of explicitly justified exceptions.
//
// Plain `npm audit --audit-level=high` has no way to say "we looked at this one,
// it is not reachable from our code, and the only available fix is a downgrade".
// The alternative is disabling the gate entirely, which is worse. This keeps the
// gate on and records the reasoning in scripts/audit-allowlist.json.
//
// Usage: node scripts/audit-gate.mjs
// Exit 0 = no unexplained high/critical vulnerabilities.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FAIL_ON = new Set(['high', 'critical']);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const allowlistPath = join(scriptDir, 'audit-allowlist.json');

function runAudit() {
  // npm audit exits non-zero whenever it finds anything, so a non-zero exit is
  // expected here — the JSON on stdout is what matters. Only a genuinely empty
  // stdout means the command itself failed.
  let stdout;
  try {
    stdout = execFileSync('npm', ['audit', '--json'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    stdout = error.stdout;
    if (!stdout) {
      console.error('npm audit did not produce any output.');
      console.error(error.stderr || error.message);
      process.exit(2);
    }
  }

  try {
    return JSON.parse(stdout);
  } catch {
    console.error('Could not parse npm audit output as JSON.');
    process.exit(2);
  }
}

function loadAllowlist() {
  const parsed = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  const entries = parsed.allow ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const expired = entries.filter((entry) => entry.expires && entry.expires < today);

  return { entries, expired, byId: new Map(entries.map((entry) => [entry.id, entry])) };
}

// `via` entries are either an advisory object or the name of another package
// that pulls the vulnerability in. Walk it until we reach the real advisories.
function resolveAdvisories(name, vulnerabilities, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);

  const vulnerability = vulnerabilities[name];
  if (!vulnerability) return [];

  const advisories = [];
  for (const via of vulnerability.via ?? []) {
    if (typeof via === 'string') {
      advisories.push(...resolveAdvisories(via, vulnerabilities, seen));
    } else if (via && typeof via === 'object') {
      advisories.push(via);
    }
  }
  return advisories;
}

function advisoryId(advisory) {
  const match = /GHSA-[\w-]+/.exec(advisory.url ?? '');
  return match ? match[0] : (advisory.url ?? String(advisory.source ?? 'unknown'));
}

const report = runAudit();
const { entries, expired, byId } = loadAllowlist();
const vulnerabilities = report.vulnerabilities ?? {};

const blocking = [];
const suppressed = [];

for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  if (!FAIL_ON.has(vulnerability.severity)) continue;

  const advisories = resolveAdvisories(name, vulnerabilities);

  // Only consider the advisories that are themselves high/critical — a package
  // can be flagged high while carrying lower-severity advisories alongside.
  const relevant = advisories.filter((advisory) => FAIL_ON.has(advisory.severity));
  const unexplained = relevant.filter((advisory) => !byId.has(advisoryId(advisory)));

  // No resolvable advisory means we cannot prove it is covered — treat as blocking.
  if (relevant.length === 0 || unexplained.length > 0) {
    blocking.push({ name, vulnerability, advisories: unexplained.length ? unexplained : advisories });
  } else {
    suppressed.push({ name, advisories: relevant });
  }
}

const counts = report.metadata?.vulnerabilities ?? {};
console.log(
  `npm audit: ${counts.total ?? 0} total ` +
  `(${counts.critical ?? 0} critical, ${counts.high ?? 0} high, ` +
  `${counts.moderate ?? 0} moderate, ${counts.low ?? 0} low)\n`
);

if (suppressed.length > 0) {
  console.log('Allowlisted (documented in scripts/audit-allowlist.json):');
  for (const { name, advisories } of suppressed) {
    for (const advisory of advisories) {
      const entry = byId.get(advisoryId(advisory));
      console.log(`  - ${name}: ${advisoryId(advisory)} (expires ${entry.expires ?? 'never'})`);
      console.log(`      ${advisory.title ?? ''}`);
    }
  }
  console.log('');
}

if (expired.length > 0) {
  console.error('Allowlist entries have expired and must be re-reviewed:');
  for (const entry of expired) {
    console.error(`  - ${entry.id} (${entry.package}) expired ${entry.expires}`);
    if (entry.reviewAction) console.error(`      Action: ${entry.reviewAction}`);
  }
  console.error('');
}

if (blocking.length > 0) {
  console.error('High/critical vulnerabilities with no allowlist entry:');
  for (const { name, vulnerability, advisories } of blocking) {
    console.error(`  - ${name} (${vulnerability.severity}) range=${vulnerability.range}`);
    for (const advisory of advisories) {
      console.error(`      ${advisoryId(advisory)}  ${advisory.title ?? ''}`);
      if (advisory.url) console.error(`      ${advisory.url}`);
    }
  }
  console.error('\nRun `npm audit fix` to resolve, or add a justified entry to scripts/audit-allowlist.json.');
}

if (blocking.length > 0 || expired.length > 0) {
  process.exit(1);
}

console.log(
  `Audit gate passed: no unexplained high/critical vulnerabilities ` +
  `(${entries.length} allowlisted ${entries.length === 1 ? 'exception' : 'exceptions'}).`
);
