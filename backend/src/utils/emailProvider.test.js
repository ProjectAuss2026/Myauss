import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseFrom,
  pickEmailProvider,
  isEmailConfigured,
  sendProviderEmail,
} from "./emailProvider.js";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

function withEnv(vars, fn) {
  const saved = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(vars)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test("parseFrom: 'Name <email>' form", () => {
  assert.deepEqual(parseFrom("AUSS <auss@club.nz>"), {
    name: "AUSS",
    email: "auss@club.nz",
  });
});

test("parseFrom: bare email", () => {
  assert.deepEqual(parseFrom("auss@club.nz"), {
    name: "AUSS",
    email: "auss@club.nz",
  });
});

test("parseFrom: nameless angle-bracket form defaults the name", () => {
  assert.deepEqual(parseFrom("<auss@club.nz>"), {
    name: "AUSS",
    email: "auss@club.nz",
  });
});

test("parseFrom: empty input", () => {
  assert.deepEqual(parseFrom(""), { name: "AUSS", email: "" });
});

test("pickEmailProvider: brevo wins over smtp", () => {
  assert.equal(
    pickEmailProvider({
      brevoApiKey: "xkeysib-test",
      smtpUser: "u",
      smtpPass: "p",
    }),
    "brevo",
  );
});

test("pickEmailProvider: smtp when no brevo key", () => {
  assert.equal(
    pickEmailProvider({ brevoApiKey: "", smtpUser: "u", smtpPass: "p" }),
    "smtp",
  );
});

test("pickEmailProvider: none when nothing configured", () => {
  assert.equal(
    pickEmailProvider({ brevoApiKey: "", smtpUser: "", smtpPass: "" }),
    "none",
  );
});

test("isEmailConfigured reflects env", () => {
  withEnv(
    { BREVO_API_KEY: undefined, SMTP_USER: undefined, SMTP_PASS: undefined },
    () => assert.equal(isEmailConfigured(), false),
  );
  withEnv({ BREVO_API_KEY: "xkeysib-test" }, () =>
    assert.equal(isEmailConfigured(), true),
  );
  withEnv(
    { BREVO_API_KEY: undefined, SMTP_USER: "u", SMTP_PASS: "p" },
    () => assert.equal(isEmailConfigured(), true),
  );
});

test("Brevo branch: posts the right payload with a timeout signal", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 201 };
  };

  await withEnv(
    {
      BREVO_API_KEY: "xkeysib-test-key",
      BREVO_SENDER_EMAIL: "auss@club.nz",
    },
    () =>
      sendProviderEmail(
        {
          to: "member@example.com",
          subject: "Hello",
          text: "plain",
          html: "<b>hi</b>",
        },
        { fetchImpl },
      ),
  );

  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, BREVO_ENDPOINT);
  assert.equal(init.method, "POST");
  assert.equal(init.headers["api-key"], "xkeysib-test-key");
  assert.ok(init.signal, "fetch must include a timeout signal");
  const body = JSON.parse(init.body);
  assert.deepEqual(body.sender, { name: "AUSS", email: "auss@club.nz" });
  assert.deepEqual(body.to, [{ email: "member@example.com" }]);
  assert.equal(body.subject, "Hello");
  assert.equal(body.textContent, "plain");
  assert.equal(body.htmlContent, "<b>hi</b>");
});

test("Brevo branch: fails fast when no sender is configured", async () => {
  let fetchCalled = false;
  const fetchImpl = async () => {
    fetchCalled = true;
    return { ok: true };
  };

  await withEnv(
    {
      BREVO_API_KEY: "xkeysib-test-key",
      BREVO_SENDER_EMAIL: undefined,
      SMTP_FROM: undefined,
      SMTP_USER: undefined,
    },
    () =>
      assert.rejects(
        sendProviderEmail({ to: "m@example.com", subject: "s" }, { fetchImpl }),
        /Brevo sender is not configured/,
      ),
  );

  assert.equal(fetchCalled, false, "must not call Brevo without a sender");
});

test("Brevo branch: error message uses Brevo's message field only", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ message: "unauthorized", apiSecret: "leak-me" }),
  });

  await withEnv(
    {
      BREVO_API_KEY: "xkeysib-test-key",
      BREVO_SENDER_EMAIL: "auss@club.nz",
    },
    () =>
      assert.rejects(
        sendProviderEmail({ to: "m@example.com", subject: "s" }, { fetchImpl }),
        (err) => {
          assert.match(err.message, /Brevo API error 401/);
          assert.match(err.message, /unauthorized/);
          assert.doesNotMatch(err.message, /leak-me/);
          return true;
        },
      ),
  );
});

test("SMTP branch: used when no Brevo key (no fetch, smtp send called)", async () => {
  let fetchCalled = false;
  const fetchImpl = async () => {
    fetchCalled = true;
    return { ok: true };
  };
  const sent = [];
  const smtpSendMail = async (msg) => {
    sent.push(msg);
  };

  await withEnv(
    {
      BREVO_API_KEY: undefined,
      SMTP_USER: "auss@gmail.com",
      SMTP_PASS: "app-pass",
      SMTP_FROM: "AUSS <auss@gmail.com>",
    },
    () =>
      sendProviderEmail(
        { to: "m@example.com", subject: "s", text: "t" },
        { fetchImpl, smtpSendMail },
      ),
  );

  assert.equal(fetchCalled, false, "no HTTP call in SMTP mode");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].from, "AUSS <auss@gmail.com>");
  assert.equal(sent[0].to, "m@example.com");
});
