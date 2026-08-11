#!/usr/bin/env node

/**
 * Smoke test for the AUSS app.
 *
 * Hits the critical public paths and exits non-zero if any fail.  Runs against
 * a running server — start it first (e.g. `npm --workspace=backend start`), then
 * run this against it.
 *
 * Usage:
 *   node scripts/smoke-test.mjs                           # defaults to http://localhost:3001
 *   SMOKE_BASE_URL=http://localhost:3004 node scripts/smoke-test.mjs
 *
 * Designed to work with Node 24 native fetch() — no dependencies.
 */

const BASE_URL = (process.env.SMOKE_BASE_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const TIMEOUT_MS = 5_000;

const TESTS = [
  {
    label: "API health endpoint",
    path: "/api/health",
    expectStatus: 200,
    expectContentType: "application/json",
    expectBodyContains: '"status":"ok"',
  },
  {
    label: "SPA serving (root)",
    path: "/",
    expectStatus: 200,
    expectContentType: "text/html",
    expectBodyContains: "<!doctype html>",
  },
  {
    label: "SPA deep-link (/admin)",
    path: "/admin",
    expectStatus: 200,
    expectContentType: "text/html",
    expectBodyContains: "<!doctype html>",
  },
  {
    label: "Public activities (GET /api/activities)",
    path: "/api/activities",
    expectStatus: 200,
    expectContentType: "application/json",
    // Should return an array (empty or populated)
  },
];

async function runTest({ label, path, expectStatus, expectContentType, expectBodyContains }) {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, { signal: controller.signal, redirect: "manual" });
  } catch (err) {
    clearTimeout(timer);
    return { label, ok: false, error: `fetch failed: ${err.message}` };
  }
  clearTimeout(timer);

  const body = await res.text();

  if (res.status !== expectStatus) {
    return { label, ok: false, error: `expected status ${expectStatus}, got ${res.status}` };
  }

  const ct = (res.headers.get("content-type") ?? "").split(";")[0];
  if (expectContentType && ct !== expectContentType) {
    return { label, ok: false, error: `expected Content-Type ${expectContentType}, got ${ct}` };
  }

  if (expectBodyContains && !body.toLowerCase().includes(expectBodyContains.toLowerCase())) {
    return {
      label,
      ok: false,
      error: `body does not contain "${expectBodyContains}" (got ${body.slice(0, 120)}...)`,
    };
  }

  return { label, ok: true };
}

async function main() {
  console.log(`🔍 Smoke test — ${BASE_URL}\n`);

  const results = await Promise.all(TESTS.map(runTest));

  let failed = 0;
  for (const r of results) {
    const icon = r.ok ? "✅" : "❌";
    console.log(`${icon} ${r.label}`);
    if (!r.ok) {
      console.log(`   ↳ ${r.error}`);
      failed++;
    }
  }

  console.log(`\n${results.length - failed}/${results.length} passed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
