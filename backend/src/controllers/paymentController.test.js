import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/test";
process.env.JWT_SECRET = "payment-ledger-test-secret";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

const usersById = new Map();
const membershipAudits = [];
const paymentsByIntentId = new Map();

let userSequence = 0;
let paymentSequence = 0;
let paymentUpsertError = null;

function cloneRecord(record) {
  return record == null ? record : structuredClone(record);
}

function selectRecord(record, select) {
  if (!record || !select) {
    return cloneRecord(record);
  }

  const selected = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (!enabled) continue;
    selected[key] = cloneRecord(record[key]);
  }
  return selected;
}

function makeUser(data = {}) {
  const id = data.id || `user-${++userSequence}`;
  const user = {
    id,
    email: data.email || `${id}@example.com`,
    role: data.role || "USER",
    tokenVersion: data.tokenVersion ?? 0,
    membershipStatus: data.membershipStatus ?? "INACTIVE",
    membershipStatusUpdatedAt: data.membershipStatusUpdatedAt || new Date(),
    info: data.info ?? null,
  };
  usersById.set(id, user);
  return user;
}

globalThis.prisma = {
  $transaction: async (arg) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg(globalThis.prisma);
  },
  user: {
    findUnique: async (args) =>
      selectRecord(usersById.get(args.where.id) || null, args.select),
    update: async (args) => {
      const user = usersById.get(args.where.id);
      if (!user) {
        throw Object.assign(new Error("User not found"), { code: "P2025" });
      }
      Object.assign(user, args.data);
      return cloneRecord(user);
    },
  },
  membershipStatusAudit: {
    create: async (args) => {
      const record = {
        ...cloneRecord(args.data),
        createdAt: args.data.createdAt || new Date(),
      };
      membershipAudits.push(record);
      return cloneRecord(record);
    },
  },
  payment: {
    upsert: async (args) => {
      if (paymentUpsertError) {
        throw paymentUpsertError;
      }

      const key = args.where.stripePaymentIntentId;
      const existing = paymentsByIntentId.get(key);
      if (existing) {
        Object.assign(existing, args.update);
        return cloneRecord(existing);
      }

      const record = {
        id: `payment-${++paymentSequence}`,
        createdAt: new Date(),
        ...cloneRecord(args.create),
      };
      paymentsByIntentId.set(key, record);
      return cloneRecord(record);
    },
  },
};

// Fake Stripe client injected through the controller's test hook.
const stripePaymentIntents = new Map();
const stripeCharges = new Map();

globalThis.__AUSS_PAYMENT_TEST_HOOKS__ = {
  stripe: {
    paymentIntents: {
      retrieve: async (paymentIntentId) => {
        const paymentIntent = stripePaymentIntents.get(paymentIntentId);
        if (!paymentIntent) {
          throw new Error(`No such payment_intent: ${paymentIntentId}`);
        }
        return structuredClone(paymentIntent);
      },
    },
    charges: {
      retrieve: async (chargeId) => {
        const charge = stripeCharges.get(chargeId);
        if (!charge) {
          throw new Error(`No such charge: ${chargeId}`);
        }
        return structuredClone(charge);
      },
    },
    webhooks: {
      // Signature verification is Stripe's code; these tests only exercise
      // our handling of a verified event.
      constructEvent: (body) => JSON.parse(body.toString("utf8")),
    },
  },
};

const { default: paymentRoutes } = await import("../routes/paymentRoutes.js");
const { handleStripeWebhook } = await import("./paymentController.js");

function createApp() {
  const app = express();
  // Mirrors app.js: the webhook sees the raw body, everything else JSON.
  app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json" }),
    handleStripeWebhook,
  );
  app.use(express.json());
  app.use("/api", paymentRoutes);
  return app;
}

async function requestApp(
  app,
  { method = "GET", path: requestPath, body, token, headers: extraHeaders } = {},
) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const headers = new Headers(extraHeaders || {});
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    let payload;
    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
      payload = JSON.stringify(body);
    }

    const response = await fetch(`http://127.0.0.1:${port}${requestPath}`, {
      method,
      headers,
      body: payload,
    });
    const text = await response.text();
    let json = null;
    if (
      (response.headers.get("content-type") || "").includes(
        "application/json",
      ) &&
      text
    ) {
      json = JSON.parse(text);
    }

    return { statusCode: response.status, text, json };
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function authToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, tv: user.tokenVersion, type: "access" },
    process.env.JWT_SECRET,
    { issuer: "auss-api", audience: "auss-web" },
  );
}

const CHARGE_CREATED_SECONDS = 1_780_000_000;

function seedSucceededPaymentIntent({
  id = "pi_test_1",
  userId,
  expandedCharge = true,
} = {}) {
  const chargeId = `ch_for_${id}`;
  const charge = {
    id: chargeId,
    created: CHARGE_CREATED_SECONDS,
    payment_method_details: {
      type: "card",
      card: { brand: "visa", last4: "4242" },
    },
  };
  stripeCharges.set(chargeId, charge);

  const paymentIntent = {
    id,
    status: "succeeded",
    amount: 2000,
    amount_received: 2000,
    currency: "nzd",
    latest_charge: expandedCharge ? charge : chargeId,
    metadata: { purpose: "auss_membership", userId },
  };
  stripePaymentIntents.set(id, paymentIntent);
  return paymentIntent;
}

function webhookEvent(paymentIntent) {
  return {
    method: "POST",
    path: "/api/payments/webhook",
    body: { type: "payment_intent.succeeded", data: { object: paymentIntent } },
    headers: { "stripe-signature": "sig_test" },
  };
}

test.beforeEach(() => {
  usersById.clear();
  membershipAudits.length = 0;
  paymentsByIntentId.clear();
  stripePaymentIntents.clear();
  stripeCharges.clear();
  userSequence = 0;
  paymentSequence = 0;
  paymentUpsertError = null;
});

test("confirm activates membership and records a ledger row", async () => {
  const user = makeUser({ email: "payer@example.com" });
  const paymentIntent = seedSucceededPaymentIntent({ userId: user.id });

  const response = await requestApp(createApp(), {
    method: "POST",
    path: "/api/payments/confirm",
    body: { paymentIntentId: paymentIntent.id },
    token: authToken(user),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.membershipStatus, "VERIFIED");
  assert.equal(usersById.get(user.id).membershipStatus, "VERIFIED");

  assert.equal(paymentsByIntentId.size, 1);
  const payment = paymentsByIntentId.get(paymentIntent.id);
  assert.equal(payment.userId, user.id);
  assert.equal(payment.payerEmail, "payer@example.com");
  assert.equal(payment.amountCents, 2000);
  assert.equal(payment.currency, "nzd");
  assert.equal(payment.method, "card");
  assert.equal(payment.cardBrand, "visa");
  assert.equal(payment.cardLast4, "4242");
  assert.equal(
    payment.paidAt.getTime(),
    CHARGE_CREATED_SECONDS * 1000,
  );
});

test("webhook activates membership and records the payment", async () => {
  const user = makeUser();
  // The webhook payload carries latest_charge as an id string, so the
  // controller has to fetch the charge for the card details.
  const paymentIntent = seedSucceededPaymentIntent({
    userId: user.id,
    expandedCharge: false,
  });

  const response = await requestApp(createApp(), webhookEvent(paymentIntent));

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.received, true);
  assert.equal(usersById.get(user.id).membershipStatus, "VERIFIED");

  assert.equal(paymentsByIntentId.size, 1);
  const payment = paymentsByIntentId.get(paymentIntent.id);
  assert.equal(payment.cardBrand, "visa");
  assert.equal(payment.cardLast4, "4242");
});

test("confirm and webhook for the same intent write a single ledger row", async () => {
  const user = makeUser();
  const paymentIntent = seedSucceededPaymentIntent({ userId: user.id });
  const app = createApp();

  const confirmResponse = await requestApp(app, {
    method: "POST",
    path: "/api/payments/confirm",
    body: { paymentIntentId: paymentIntent.id },
    token: authToken(user),
  });
  assert.equal(confirmResponse.statusCode, 200);

  const webhookResponse = await requestApp(app, webhookEvent(paymentIntent));
  assert.equal(webhookResponse.statusCode, 200);

  const retriedWebhookResponse = await requestApp(
    app,
    webhookEvent(paymentIntent),
  );
  assert.equal(retriedWebhookResponse.statusCode, 200);

  assert.equal(paymentsByIntentId.size, 1);
  assert.equal(usersById.get(user.id).membershipStatus, "VERIFIED");
});

test("confirm rejects a payment intent belonging to another user", async () => {
  const payer = makeUser();
  const intruder = makeUser();
  const paymentIntent = seedSucceededPaymentIntent({ userId: payer.id });

  const response = await requestApp(createApp(), {
    method: "POST",
    path: "/api/payments/confirm",
    body: { paymentIntentId: paymentIntent.id },
    token: authToken(intruder),
  });

  assert.equal(response.statusCode, 403);
  assert.equal(paymentsByIntentId.size, 0);
  assert.equal(usersById.get(intruder.id).membershipStatus, "INACTIVE");
});

test("confirm still succeeds when the ledger write fails", async () => {
  const user = makeUser();
  const paymentIntent = seedSucceededPaymentIntent({ userId: user.id });
  paymentUpsertError = new Error("ledger unavailable");

  const response = await requestApp(createApp(), {
    method: "POST",
    path: "/api/payments/confirm",
    body: { paymentIntentId: paymentIntent.id },
    token: authToken(user),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.membershipStatus, "VERIFIED");
  assert.equal(paymentsByIntentId.size, 0);
});

test("webhook returns 500 when the ledger write fails so Stripe retries", async () => {
  const user = makeUser();
  const paymentIntent = seedSucceededPaymentIntent({
    userId: user.id,
    expandedCharge: false,
  });
  paymentUpsertError = new Error("ledger unavailable");

  const response = await requestApp(createApp(), webhookEvent(paymentIntent));

  assert.equal(response.statusCode, 500);
  assert.equal(response.json.received, false);
  assert.equal(paymentsByIntentId.size, 0);

  // Retry after the outage: activation is idempotent and the row lands.
  paymentUpsertError = null;
  const retryResponse = await requestApp(
    createApp(),
    webhookEvent(paymentIntent),
  );
  assert.equal(retryResponse.statusCode, 200);
  assert.equal(paymentsByIntentId.size, 1);
  assert.equal(usersById.get(user.id).membershipStatus, "VERIFIED");
});
