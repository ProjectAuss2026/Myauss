import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseAllowlist,
  validateEmailDeliverability,
} from "../utils/emailDeliverability.js";

test("validateEmailDeliverability returns deliverable:true for an allowlisted domain", async () => {
  let calls = 0;
  const result = await validateEmailDeliverability("user@auckland.ac.nz", {
    allowlist: new Set(["auckland.ac.nz"]),
    resolveMx: async () => {
      calls += 1;
      return [];
    },
  });

  assert.equal(result.deliverable, true);
  assert.equal(calls, 0);
});

test("validateEmailDeliverability returns deliverable:true when MX records exist", async () => {
  const result = await validateEmailDeliverability("user@example.com", {
    resolveMx: async () => [{ exchange: "mail.example.com", priority: 10 }],
  });

  assert.equal(result.deliverable, true);
});

test("validateEmailDeliverability returns deliverable:false when MX resolves to empty array", async () => {
  const result = await validateEmailDeliverability("user@no-mx-records.com", {
    resolveMx: async () => [],
  });

  assert.equal(result.deliverable, false);
  assert.equal(result.reason, "no_mx_records");
});

test("validateEmailDeliverability fails open on DNS timeout", async () => {
  const start = Date.now();
  const result = await validateEmailDeliverability("user@timeout.com", {
    resolveMx: async () => new Promise(() => {}),
    timeoutMs: 10,
  });
  const elapsed = Date.now() - start;

  assert.equal(result.deliverable, true);
  assert.ok(elapsed < 500);
});

test("validateEmailDeliverability fails open on other DNS errors", async () => {
  const result = await validateEmailDeliverability("user@dns-error.com", {
    resolveMx: async () => {
      throw Object.assign(new Error("SERVFAIL"), { code: "SERVFAIL" });
    },
  });

  assert.equal(result.deliverable, true);
});

test("validateEmailDeliverability returns deliverable:false for invalid email format", async () => {
  const result = await validateEmailDeliverability("notanemail");

  assert.equal(result.deliverable, false);
  assert.equal(result.reason, "invalid_email_format");
});

test("validateEmailDeliverability returns deliverable:false for email with no at sign", async () => {
  const result = await validateEmailDeliverability("noatsign.com");

  assert.equal(result.deliverable, false);
  assert.equal(result.reason, "invalid_email_format");
});

test("parseAllowlist parses comma-separated domains into a Set", () => {
  const result = parseAllowlist(
    "auckland.ac.nz, aucklanduni.ac.nz , EXAMPLE.COM",
  );

  assert.deepEqual(
    result,
    new Set(["auckland.ac.nz", "aucklanduni.ac.nz", "example.com"]),
  );
});

test("parseAllowlist returns empty Set for empty string", () => {
  assert.deepEqual(parseAllowlist(""), new Set());
});

test("parseAllowlist returns empty Set for null or undefined", () => {
  assert.deepEqual(parseAllowlist(null), new Set());
  assert.deepEqual(parseAllowlist(undefined), new Set());
});
