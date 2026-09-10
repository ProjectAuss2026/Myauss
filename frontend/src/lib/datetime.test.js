import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { datetimeLocalToISO, formatToDatetimeLocal } from './datetime.ts';

// Regression guard for the prod timezone shift.
//
// The bug: datetimeLocalToISO() returned a timezone-NAIVE string
// ("2026-01-15T14:30:00", no Z/offset), so the server parsed it in ITS timezone.
// Railway runs in UTC, so every activity time was stored shifted by the admin's
// offset. A plain same-process round-trip does NOT catch this — a naive string
// round-trips fine within a single timezone, which is why it only broke in prod.
// What must hold is that the value is an ABSOLUTE instant.
test('datetimeLocalToISO returns an absolute UTC instant, not a naive string', () => {
  const out = datetimeLocalToISO('2026-01-15T14:30');

  // Fails on the old implementation: "2026-01-15T14:30:00" has no UTC anchor.
  assert.match(out, /Z$/, 'must carry an explicit UTC anchor');
  assert.equal(
    new Date(out).toISOString(),
    out,
    'must already be a canonical ISO instant (parsing it adds no timezone shift)',
  );
});

// Run under TZ=UTC in CI (see ci.yml) so this proves there is no hidden
// dependency on the machine's timezone being New Zealand.
test('a local wall clock survives datetimeLocalToISO -> server -> formatToDatetimeLocal', () => {
  const wallClocks = [
    '2026-01-15T14:30',
    '2026-06-01T09:05',
    '2026-12-31T23:59',
    '2026-03-08T00:00',
  ];

  for (const wall of wallClocks) {
    const sent = datetimeLocalToISO(wall);      // browser -> server
    const stored = new Date(sent);              // server parses the instant
    const readBack = formatToDatetimeLocal(stored); // browser reads it back

    assert.equal(readBack, wall, `wall clock ${wall} must survive the round trip`);
  }
});

// The real prod scenario, which a single-timezone test cannot express: the admin
// is in New Zealand, the server is in UTC. Run the conversion + read-back in a
// child process with an explicit TZ, and assert the exact instant each timezone
// must produce for the same wall clock.
const moduleUrl = new URL('./datetime.ts', import.meta.url).href;

function roundTripInTimezone(tz, wall) {
  const script = `
    import { datetimeLocalToISO, formatToDatetimeLocal } from ${JSON.stringify(moduleUrl)};
    const wall = ${JSON.stringify(wall)};
    const iso = datetimeLocalToISO(wall);
    console.log(JSON.stringify({ iso, readBack: formatToDatetimeLocal(iso) }));
  `;
  const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  });
  return JSON.parse(stdout.trim());
}

test('the same wall clock maps to the correct instant in different admin timezones', () => {
  const wall = '2026-01-15T14:30'; // 2:30 PM

  // Admin in New Zealand (NZDT, UTC+13 in January): 14:30 local == 01:30Z.
  const nz = roundTripInTimezone('Pacific/Auckland', wall);
  assert.equal(nz.iso, '2026-01-15T01:30:00.000Z', 'NZ admin: 14:30 NZDT must be 01:30Z');
  assert.equal(nz.readBack, wall, 'NZ admin must read back the same wall clock');

  // Admin in UTC: 14:30 local == 14:30Z.
  const utc = roundTripInTimezone('UTC', wall);
  assert.equal(utc.iso, '2026-01-15T14:30:00.000Z', 'UTC admin: 14:30 must be 14:30Z');
  assert.equal(utc.readBack, wall, 'UTC admin must read back the same wall clock');

  // And the server (running in UTC) stores the SAME instant the NZ admin meant —
  // this is what the naive string got wrong.
  const storedInstant = new Date(nz.iso);
  assert.equal(storedInstant.toISOString(), '2026-01-15T01:30:00.000Z');
  assert.notEqual(
    storedInstant.toISOString(),
    new Date(`${wall}:00Z`).toISOString(),
    'must not be mistaken for 14:30Z (the naive-string bug)',
  );
});

test('empty and invalid input degrade safely to an empty string', () => {
  assert.equal(datetimeLocalToISO(''), '');
  assert.equal(datetimeLocalToISO('not-a-date'), '');
  assert.equal(formatToDatetimeLocal(''), '');
  assert.equal(formatToDatetimeLocal(undefined), '');
  assert.equal(formatToDatetimeLocal('not-a-date'), '');
});

test('formatToDatetimeLocal renders a Date in local time with zero-padding', () => {
  const date = new Date(2026, 0, 5, 9, 5); // local 2026-01-05 09:05
  assert.equal(formatToDatetimeLocal(date), '2026-01-05T09:05');
});
