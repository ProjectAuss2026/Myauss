import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import os from "node:os";
import path from "node:path";
import { promises as fsPromises } from "node:fs";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/test";
process.env.JWT_SECRET = "payment-proof-test-secret";
process.env.STUDENT_ID_PEPPER = "payment-proof-test-pepper";
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

const STRONG_TEST_PASSWORD = "CorrectHorseBatteryStaple!2026";
const VALID_PROOF_UPLOAD_ID = "550e8400-e29b-41d4-a716-446655440000";

const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00, 0xff, 0xd9,
]);
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);
const WEBP_BYTES = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56,
  0x50, 0x38, 0x20, 0x00, 0x00, 0x00, 0x00,
]);
const SVG_BYTES = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
  "utf8",
);
const INVALID_BYTES = Buffer.from("not-an-image", "utf8");

const usersByEmail = new Map();
const usersById = new Map();
const paymentProofsById = new Map();
const otpCodesByUserId = new Map();
const membershipAudits = [];
const declinedPaymentProofEmails = [];

let tempUploadDir = "";
let userSequence = 0;
let paymentProofSequence = 0;

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

function makeUser(data) {
  const id = data.id || `user-${++userSequence}`;
  return {
    id,
    email: data.email,
    passwordHash: data.passwordHash || "hashed-password",
    role: data.role || "USER",
    tokenVersion: data.tokenVersion ?? 0,
    isVerified: data.isVerified ?? false,
    membershipStatus: data.membershipStatus ?? "INACTIVE",
    membershipStatusUpdatedAt: data.membershipStatusUpdatedAt || new Date(),
    lastCodeSentAt: data.lastCodeSentAt || new Date(),
    verificationExpiresAt:
      data.verificationExpiresAt || new Date(Date.now() + 60_000),
    info: data.info ?? null,
  };
}

function storeUser(user) {
  usersByEmail.set(user.email, user);
  usersById.set(user.id, user);
  return user;
}

function filterUsers(where = {}) {
  return Array.from(usersById.values()).filter((user) => {
    if (
      where.membershipStatus !== undefined &&
      user.membershipStatus !== where.membershipStatus
    ) {
      return false;
    }

    return true;
  });
}

function makePaymentProof(data = {}) {
  const id = data.id || `proof-${++paymentProofSequence}`;
  const createdAt = data.createdAt ?? new Date();
  return {
    id,
    userId: data.userId ?? null,
    originalFilename: data.originalFilename ?? "receipt.jpg",
    fileBytes: data.fileBytes ?? Buffer.from(JPEG_BYTES),
    mimeType: data.mimeType ?? "image/jpeg",
    sizeBytes: data.sizeBytes ?? JPEG_BYTES.length,
    status: data.status ?? "PENDING",
    linkedAt: data.linkedAt ?? null,
    createdAt,
    updatedAt: data.updatedAt ?? createdAt,
    expiresAt: data.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
  };
}

function storePaymentProof(upload) {
  paymentProofsById.set(upload.id, upload);
  return upload;
}

function matchesDateCondition(value, condition) {
  if (!condition) return true;
  if (condition.lt && !(value < condition.lt)) return false;
  if (condition.gt && !(value > condition.gt)) return false;
  return true;
}

function filterPaymentProofs(where = {}) {
  return Array.from(paymentProofsById.values()).filter((upload) => {
    if (where.id?.in && !where.id.in.includes(upload.id)) return false;
    if (where.userId !== undefined && upload.userId !== where.userId)
      return false;
    if (where.userId === null && upload.userId !== null) return false;
    if (where.status !== undefined && upload.status !== where.status)
      return false;
    if (where.linkedAt === null && upload.linkedAt !== null) return false;
    if (!matchesDateCondition(upload.expiresAt, where.expiresAt)) return false;
    return true;
  });
}

function sortProofs(uploads, orderBy = []) {
  return [...uploads].sort((left, right) => {
    for (const clause of orderBy) {
      const [field, direction] = Object.entries(clause)[0];
      const multiplier = direction === "desc" ? -1 : 1;
      const leftValue = left[field];
      const rightValue = right[field];

      if (leftValue == null && rightValue == null) continue;
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;
      if (leftValue > rightValue) return multiplier;
      if (leftValue < rightValue) return -multiplier;
    }
    return 0;
  });
}

globalThis.prisma = {
  $transaction: async (arg) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg(globalThis.prisma);
  },
  user: {
    findUnique: async (args) => {
      if (args.where.email) {
        return selectRecord(
          usersByEmail.get(args.where.email) || null,
          args.select,
        );
      }
      if (args.where.id) {
        return selectRecord(usersById.get(args.where.id) || null, args.select);
      }
      return null;
    },
    create: async (args) => {
      const user = makeUser({
        email: args.data.email,
        passwordHash: args.data.passwordHash,
        role: args.data.role,
        isVerified: args.data.isVerified,
        membershipStatus: args.data.membershipStatus,
        membershipStatusUpdatedAt: args.data.membershipStatusUpdatedAt,
        lastCodeSentAt: args.data.lastCodeSentAt,
        verificationExpiresAt: args.data.verificationExpiresAt,
        info: {
          id: `info-${userSequence + 1}`,
          userId: `user-${userSequence + 1}`,
          ...args.data.info.create,
        },
      });

      storeUser(user);
      return selectRecord(user, args.select);
    },
    update: async (args) => {
      const user = args.where.email
        ? usersByEmail.get(args.where.email)
        : usersById.get(args.where.id);
      if (!user) {
        throw Object.assign(new Error("User not found"), { code: "P2025" });
      }

      const { info, ...rest } = args.data;
      Object.assign(user, rest);

      if (info?.upsert) {
        user.info = {
          id: user.info?.id || `info-${user.id}`,
          userId: user.id,
          ...(user.info ? info.upsert.update : info.upsert.create),
        };
      }

      return selectRecord(user, args.select);
    },
    count: async (args = {}) => filterUsers(args.where).length,
    findMany: async (args = {}) => {
      const users = [...filterUsers(args.where)].sort((left, right) => {
        for (const clause of args.orderBy || []) {
          const [field, direction] = Object.entries(clause)[0];
          const multiplier = direction === "desc" ? -1 : 1;
          const leftValue = left[field];
          const rightValue = right[field];

          if (leftValue == null && rightValue == null) continue;
          if (leftValue == null) return 1;
          if (rightValue == null) return -1;
          if (leftValue > rightValue) return multiplier;
          if (leftValue < rightValue) return -multiplier;
        }

        return 0;
      });

      const start = args.skip || 0;
      const end = args.take ? start + args.take : undefined;
      return cloneRecord(users.slice(start, end));
    },
  },
  otpCode: {
    upsert: async (args) => {
      const record = {
        userId: args.where.userId,
        ...(otpCodesByUserId.get(args.where.userId)
          ? args.update
          : args.create),
      };
      otpCodesByUserId.set(args.where.userId, record);
      return cloneRecord(record);
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
  paymentProofUpload: {
    create: async (args) => {
      const upload = makePaymentProof({
        ...args.data,
        createdAt: args.data.createdAt || new Date(),
      });
      storePaymentProof(upload);
      return cloneRecord(upload);
    },
    findUnique: async (args) => {
      return selectRecord(
        paymentProofsById.get(args.where.id) || null,
        args.select,
      );
    },
    findMany: async (args = {}) => {
      const uploads = sortProofs(filterPaymentProofs(args.where), args.orderBy);
      return cloneRecord(
        args.select
          ? uploads.map((upload) => selectRecord(upload, args.select))
          : uploads,
      );
    },
    updateMany: async (args) => {
      const uploads = filterPaymentProofs(args.where);
      for (const upload of uploads) {
        Object.assign(upload, args.data);
      }
      return { count: uploads.length };
    },
    delete: async (args) => {
      const upload = paymentProofsById.get(args.where.id) || null;
      if (upload) {
        paymentProofsById.delete(args.where.id);
      }
      return cloneRecord(upload);
    },
    deleteMany: async (args) => {
      const uploads = filterPaymentProofs(args.where);
      for (const upload of uploads) {
        paymentProofsById.delete(upload.id);
      }
      return { count: uploads.length };
    },
  },
};

const { default: authController } = await import("./auth.controller.js");
const { PAYMENT_PROOF_UPLOAD_STATUS } =
  await import("../services/paymentProofUploads.js");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authController);
  return app;
}

async function requestApp(
  app,
  { method = "GET", path: requestPath, body, formData, token } = {},
) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const headers = new Headers();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    let payload;
    if (formData) {
      payload = formData;
    } else if (body !== undefined) {
      headers.set("Content-Type", "application/json");
      payload = JSON.stringify(body);
    }

    const response = await fetch(`http://127.0.0.1:${port}${requestPath}`, {
      method,
      headers,
      body: payload,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    const text = buffer.toString("utf8");
    let json = null;
    if (
      (response.headers.get("content-type") || "").includes(
        "application/json",
      ) &&
      text
    ) {
      json = JSON.parse(text);
    }

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      text,
      json,
      buffer,
    };
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

function createProofFormData(buffer, filename, contentType) {
  const formData = new FormData();
  formData.append("proof", new Blob([buffer], { type: contentType }), filename);
  return formData;
}

async function fileExists(filePath) {
  try {
    await fsPromises.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resetState() {
  usersByEmail.clear();
  usersById.clear();
  paymentProofsById.clear();
  otpCodesByUserId.clear();
  membershipAudits.length = 0;
  declinedPaymentProofEmails.length = 0;
  userSequence = 0;
  paymentProofSequence = 0;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_FROM;
  delete globalThis.__AUSS_AUTH_TEST_HOOKS__;
  if (tempUploadDir) {
    await fsPromises.rm(tempUploadDir, { recursive: true, force: true });
  }
  tempUploadDir = path.join(
    os.tmpdir(),
    `auss-payment-proofs-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  process.env.PAYMENT_PROOF_UPLOADS_DIR = tempUploadDir;
  process.env.PAYMENT_PROOF_UPLOAD_RETENTION_HOURS = "24";
}

test.beforeEach(async () => {
  await resetState();
});

test.afterEach(async () => {
  if (tempUploadDir) {
    await fsPromises.rm(tempUploadDir, { recursive: true, force: true });
  }
  delete process.env.PAYMENT_PROOF_UPLOADS_DIR;
  delete process.env.PAYMENT_PROOF_UPLOAD_RETENTION_HOURS;
});

test("staged proof upload accepts valid jpg, png, and webp image proof", async () => {
  const app = createApp();

  for (const file of [
    {
      bytes: JPEG_BYTES,
      filename: "receipt.jpg",
      type: "image/jpeg",
      expectedMime: "image/jpeg",
    },
    {
      bytes: PNG_BYTES,
      filename: "receipt.png",
      type: "image/png",
      expectedMime: "image/png",
    },
    {
      bytes: WEBP_BYTES,
      filename: "receipt.webp",
      type: "image/webp",
      expectedMime: "image/webp",
    },
  ]) {
    const response = await requestApp(app, {
      method: "POST",
      path: "/api/auth/payment-proofs/pending",
      formData: createProofFormData(file.bytes, file.filename, file.type),
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json.data.originalFilename, file.filename);
    assert.equal(response.json.data.mimeType, file.expectedMime);
  }
});

test("staged proof upload rejects SVG", async () => {
  const response = await requestApp(createApp(), {
    method: "POST",
    path: "/api/auth/payment-proofs/pending",
    formData: createProofFormData(SVG_BYTES, "receipt.svg", "image/svg+xml"),
  });

  assert.equal(response.statusCode, 415);
  assert.equal(response.json.error, "Unsupported media type");
  assert.equal(response.json.message, "SVG files are not allowed.");
});

test("staged proof upload rejects invalid magic bytes", async () => {
  const response = await requestApp(createApp(), {
    method: "POST",
    path: "/api/auth/payment-proofs/pending",
    formData: createProofFormData(INVALID_BYTES, "receipt.png", "image/png"),
  });

  assert.equal(response.statusCode, 415);
  assert.equal(response.json.error, "Unsupported media type");
});

test("staged proof upload rejects oversized files", async () => {
  const oversized = Buffer.concat([
    JPEG_BYTES,
    Buffer.alloc(10 * 1024 * 1024 + 1 - JPEG_BYTES.length, 0),
  ]);
  const response = await requestApp(createApp(), {
    method: "POST",
    path: "/api/auth/payment-proofs/pending",
    formData: createProofFormData(oversized, "receipt.jpg", "image/jpeg"),
  });

  assert.equal(response.statusCode, 413);
  assert.equal(response.json.error, "File too large");
  assert.equal(
    response.json.message,
    "Uploaded files must be 10 MB or smaller.",
  );
});

test("staged proof upload stores file bytes in the database and does not write files to disk", async () => {
  const response = await requestApp(createApp(), {
    method: "POST",
    path: "/api/auth/payment-proofs/pending",
    formData: createProofFormData(JPEG_BYTES, "receipt.jpg", "image/jpeg"),
  });
  const [upload] = Array.from(paymentProofsById.values());

  assert.equal(response.statusCode, 201);
  assert.deepEqual(Buffer.from(upload.fileBytes), JPEG_BYTES);
  assert.equal(await fileExists(tempUploadDir), false);
});

test("staged proof upload returns proofUploadId and safe metadata", async () => {
  const response = await requestApp(createApp(), {
    method: "POST",
    path: "/api/auth/payment-proofs/pending",
    formData: createProofFormData(JPEG_BYTES, "receipt.jpg", "image/jpeg"),
  });

  assert.equal(response.statusCode, 201);
  assert.equal(typeof response.json.data.id, "string");
  assert.equal(response.json.data.originalFilename, "receipt.jpg");
  assert.equal(response.json.data.mimeType, "image/jpeg");
  assert.equal(response.json.data.sizeBytes, JPEG_BYTES.length);
  assert.ok(response.json.data.expiresAt);
  assert.equal(response.json.data.fileBytes, undefined);
  assert.equal(response.json.data.storagePath, undefined);
});

test("staged proof deletion works for unlinked proof", async () => {
  const created = await requestApp(createApp(), {
    method: "POST",
    path: "/api/auth/payment-proofs/pending",
    formData: createProofFormData(JPEG_BYTES, "receipt.jpg", "image/jpeg"),
  });
  const proofId = created.json.data.id;

  const response = await requestApp(createApp(), {
    method: "DELETE",
    path: `/api/auth/payment-proofs/pending/${proofId}`,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(paymentProofsById.has(proofId), false);
});

test("staged proof deletion rejects already-linked proof", async () => {
  const user = storeUser(
    makeUser({ email: "member@example.com", isVerified: false }),
  );
  const upload = storePaymentProof(
    makePaymentProof({
      id: VALID_PROOF_UPLOAD_ID,
      userId: user.id,
      status: PAYMENT_PROOF_UPLOAD_STATUS.LINKED,
      linkedAt: new Date(),
    }),
  );

  const response = await requestApp(createApp(), {
    method: "DELETE",
    path: `/api/auth/payment-proofs/pending/${upload.id}`,
  });

  assert.equal(response.statusCode, 409);
  assert.equal(
    response.json.error,
    "Linked payment proof uploads cannot be deleted",
  );
});

test("registration with Cash / Bank Transfer fails without proofUploadIds", async () => {
  const response = await requestApp(createApp(), {
    method: "POST",
    path: "/api/auth/register",
    body: {
      email: "cash@example.com",
      password: STRONG_TEST_PASSWORD,
      firstName: "Cash",
      lastName: "Member",
      studentId: "123456789",
      paymentMethod: "CASH_BANK_TRANSFER",
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json.error, "Validation failed");
  assert.ok(
    response.json.details.some(
      (detail) =>
        detail.path === "body.proofUploadIds" &&
        detail.message.includes("required for Cash / Bank Transfer"),
    ),
  );
});

test("registration with invalid proofUploadIds fails", async () => {
  const response = await requestApp(createApp(), {
    method: "POST",
    path: "/api/auth/register",
    body: {
      email: "cash@example.com",
      password: STRONG_TEST_PASSWORD,
      firstName: "Cash",
      lastName: "Member",
      studentId: "123456789",
      paymentMethod: "CASH_BANK_TRANSFER",
      proofUploadIds: [VALID_PROOF_UPLOAD_ID],
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(
    response.json.error,
    "One or more payment proof uploads are invalid",
  );
});

test("registration with expired proofUploadIds fails", async () => {
  storePaymentProof(
    makePaymentProof({
      id: VALID_PROOF_UPLOAD_ID,
      expiresAt: new Date(Date.now() - 1000),
    }),
  );

  const response = await requestApp(createApp(), {
    method: "POST",
    path: "/api/auth/register",
    body: {
      email: "cash@example.com",
      password: STRONG_TEST_PASSWORD,
      firstName: "Cash",
      lastName: "Member",
      studentId: "123456789",
      paymentMethod: "CASH_BANK_TRANSFER",
      proofUploadIds: [VALID_PROOF_UPLOAD_ID],
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(
    response.json.error,
    "One or more payment proof uploads have expired. Please upload them again.",
  );
});

test("registration with already-linked proofUploadIds fails", async () => {
  const linkedUser = storeUser(
    makeUser({ email: "linked@example.com", isVerified: true }),
  );
  storePaymentProof(
    makePaymentProof({
      id: VALID_PROOF_UPLOAD_ID,
      userId: linkedUser.id,
      status: PAYMENT_PROOF_UPLOAD_STATUS.LINKED,
      linkedAt: new Date(),
    }),
  );

  const response = await requestApp(createApp(), {
    method: "POST",
    path: "/api/auth/register",
    body: {
      email: "cash@example.com",
      password: STRONG_TEST_PASSWORD,
      firstName: "Cash",
      lastName: "Member",
      studentId: "123456789",
      paymentMethod: "CASH_BANK_TRANSFER",
      proofUploadIds: [VALID_PROOF_UPLOAD_ID],
    },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(
    response.json.error,
    "One or more payment proof uploads are already linked",
  );
});

test("registration with valid proofUploadIds links proof uploads to the created user", async () => {
  storePaymentProof(makePaymentProof({ id: VALID_PROOF_UPLOAD_ID }));

  const response = await requestApp(createApp(), {
    method: "POST",
    path: "/api/auth/register",
    body: {
      email: "cash@example.com",
      password: STRONG_TEST_PASSWORD,
      firstName: "Cash",
      lastName: "Member",
      studentId: "123456789",
      paymentMethod: "CASH_BANK_TRANSFER",
      proofUploadIds: [VALID_PROOF_UPLOAD_ID],
    },
  });
  const createdUser = usersByEmail.get("cash@example.com");
  const upload = paymentProofsById.get(VALID_PROOF_UPLOAD_ID);

  assert.equal(response.statusCode, 200);
  assert.equal(upload.userId, createdUser.id);
  assert.equal(upload.status, PAYMENT_PROOF_UPLOAD_STATUS.LINKED);
  assert.ok(upload.linkedAt instanceof Date);
});

test("registration with Cash / Bank Transfer sets membershipStatus to NEED_REVIEW", async () => {
  storePaymentProof(makePaymentProof({ id: VALID_PROOF_UPLOAD_ID }));

  const response = await requestApp(createApp(), {
    method: "POST",
    path: "/api/auth/register",
    body: {
      email: "cash@example.com",
      password: STRONG_TEST_PASSWORD,
      firstName: "Cash",
      lastName: "Member",
      studentId: "123456789",
      paymentMethod: "CASH_BANK_TRANSFER",
      proofUploadIds: [VALID_PROOF_UPLOAD_ID],
    },
  });
  const createdUser = usersByEmail.get("cash@example.com");

  assert.equal(response.statusCode, 200);
  assert.equal(createdUser.membershipStatus, "NEED_REVIEW");
  assert.equal(response.json.pendingMembershipReview, true);
});

test("normal registration path still works", async () => {
  const response = await requestApp(createApp(), {
    method: "POST",
    path: "/api/auth/register",
    body: {
      email: "member@example.com",
      password: STRONG_TEST_PASSWORD,
      firstName: "Normal",
      lastName: "Member",
      studentId: "123456789",
    },
  });
  const createdUser = usersByEmail.get("member@example.com");

  assert.equal(response.statusCode, 200);
  assert.equal(createdUser.membershipStatus, "INACTIVE");
  assert.equal(response.json.pendingMembershipReview, false);
});

test("admin proof metadata endpoint rejects unauthenticated users", async () => {
  const member = storeUser(makeUser({ email: "member@example.com" }));
  const response = await requestApp(createApp(), {
    path: `/api/auth/admin/members/${member.id}/payment-proofs`,
  });

  assert.equal(response.statusCode, 401);
});

test("admin proof metadata endpoint rejects non-admin users", async () => {
  const member = storeUser(makeUser({ email: "member@example.com" }));
  const user = storeUser(
    makeUser({ email: "user@example.com", role: "USER", isVerified: true }),
  );
  const response = await requestApp(createApp(), {
    path: `/api/auth/admin/members/${member.id}/payment-proofs`,
    token: authToken(user),
  });

  assert.equal(response.statusCode, 403);
});

test("admin proof metadata endpoint works for ADMIN or OWNER", async () => {
  const member = storeUser(makeUser({ email: "member@example.com" }));
  storePaymentProof(
    makePaymentProof({
      id: VALID_PROOF_UPLOAD_ID,
      userId: member.id,
      status: PAYMENT_PROOF_UPLOAD_STATUS.LINKED,
      linkedAt: new Date(),
    }),
  );
  const admin = storeUser(
    makeUser({ email: "admin@example.com", role: "ADMIN", isVerified: true }),
  );
  const owner = storeUser(
    makeUser({ email: "owner@example.com", role: "OWNER", isVerified: true }),
  );

  for (const actor of [admin, owner]) {
    const response = await requestApp(createApp(), {
      path: `/api/auth/admin/members/${member.id}/payment-proofs`,
      token: authToken(actor),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json.data.length, 1);
    assert.equal(response.json.data[0].id, VALID_PROOF_UPLOAD_ID);
    assert.equal(response.json.data[0].fileBytes, undefined);
    assert.equal(response.json.data[0].privatePath, undefined);
    assert.equal(response.json.data[0].storagePath, undefined);
  }
});

test("admin proof file endpoint rejects unauthenticated users", async () => {
  const response = await requestApp(createApp(), {
    path: `/api/auth/admin/payment-proofs/${VALID_PROOF_UPLOAD_ID}/file`,
  });

  assert.equal(response.statusCode, 401);
});

test("admin proof file endpoint rejects non-admin users", async () => {
  const member = storeUser(makeUser({ email: "member@example.com" }));
  const upload = storePaymentProof(
    makePaymentProof({
      id: VALID_PROOF_UPLOAD_ID,
      userId: member.id,
      status: PAYMENT_PROOF_UPLOAD_STATUS.LINKED,
      linkedAt: new Date(),
    }),
  );
  const user = storeUser(
    makeUser({ email: "user@example.com", role: "USER", isVerified: true }),
  );

  const response = await requestApp(createApp(), {
    path: `/api/auth/admin/payment-proofs/${upload.id}/file`,
    token: authToken(user),
  });

  assert.equal(response.statusCode, 403);
});

test("admin proof file endpoint works for ADMIN or OWNER", async () => {
  const member = storeUser(makeUser({ email: "member@example.com" }));
  const upload = storePaymentProof(
    makePaymentProof({
      id: VALID_PROOF_UPLOAD_ID,
      userId: member.id,
      originalFilename: "receipt.png",
      mimeType: "image/png",
      fileBytes: Buffer.from(PNG_BYTES),
      status: PAYMENT_PROOF_UPLOAD_STATUS.LINKED,
      linkedAt: new Date(),
    }),
  );
  const admin = storeUser(
    makeUser({ email: "admin@example.com", role: "ADMIN", isVerified: true }),
  );
  const owner = storeUser(
    makeUser({ email: "owner@example.com", role: "OWNER", isVerified: true }),
  );

  for (const actor of [admin, owner]) {
    const response = await requestApp(createApp(), {
      path: `/api/auth/admin/payment-proofs/${upload.id}/file`,
      token: authToken(actor),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-type"], "image/png");
    assert.ok(response.headers["content-disposition"].includes("receipt.png"));
    assert.deepEqual(response.buffer, PNG_BYTES);
  }
});

test("membership status endpoint rejects unauthenticated users", async () => {
  const member = storeUser(
    makeUser({ email: "member@example.com", membershipStatus: "NEED_REVIEW" }),
  );

  const response = await requestApp(createApp(), {
    method: "POST",
    path: `/api/auth/admin/members/${member.id}/status`,
    body: {
      status: "VERIFIED",
      reason: "Payment proof approved",
    },
  });

  assert.equal(response.statusCode, 401);
});

test("membership status endpoint rejects normal USER users", async () => {
  const member = storeUser(
    makeUser({ email: "member@example.com", membershipStatus: "NEED_REVIEW" }),
  );
  const actor = storeUser(
    makeUser({ email: "user@example.com", role: "USER", isVerified: true }),
  );

  const response = await requestApp(createApp(), {
    method: "POST",
    path: `/api/auth/admin/members/${member.id}/status`,
    token: authToken(actor),
    body: {
      status: "VERIFIED",
      reason: "Payment proof approved",
    },
  });

  assert.equal(response.statusCode, 403);
});

test("decline endpoint rejects unauthenticated users", async () => {
  const member = storeUser(
    makeUser({ email: "member@example.com", membershipStatus: "NEED_REVIEW" }),
  );

  const response = await requestApp(createApp(), {
    method: "POST",
    path: `/api/auth/admin/members/${member.id}/status`,
    body: {
      status: "INACTIVE",
      reason: "Receipt does not match the membership payment",
    },
  });

  assert.equal(response.statusCode, 401);
});

test("decline endpoint rejects normal USER users", async () => {
  const member = storeUser(
    makeUser({ email: "member@example.com", membershipStatus: "NEED_REVIEW" }),
  );
  const actor = storeUser(
    makeUser({ email: "user@example.com", role: "USER", isVerified: true }),
  );

  const response = await requestApp(createApp(), {
    method: "POST",
    path: `/api/auth/admin/members/${member.id}/status`,
    token: authToken(actor),
    body: {
      status: "INACTIVE",
      reason: "Receipt does not match the membership payment",
    },
  });

  assert.equal(response.statusCode, 403);
});

test("membership status endpoint allows ADMIN or OWNER to approve NEED_REVIEW users and writes an audit trail", async () => {
  for (const actorRole of ["ADMIN", "OWNER"]) {
    const member = storeUser(
      makeUser({
        id: `review-${actorRole.toLowerCase()}-member`,
        email: `review-${actorRole.toLowerCase()}@example.com`,
        membershipStatus: "NEED_REVIEW",
        info: {
          id: `info-${actorRole.toLowerCase()}`,
          userId: `review-${actorRole.toLowerCase()}-member`,
          firstName: "Cash",
          lastName: "Member",
        },
      }),
    );
    const actor = storeUser(
      makeUser({
        email: `${actorRole.toLowerCase()}@example.com`,
        role: actorRole,
        isVerified: true,
      }),
    );

    const response = await requestApp(createApp(), {
      method: "POST",
      path: `/api/auth/admin/members/${member.id}/status`,
      token: authToken(actor),
      body: {
        status: "VERIFIED",
        reason: "Payment proof approved",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(usersById.get(member.id)?.membershipStatus, "VERIFIED");
    assert.equal(response.json.data.membershipStatus, "VERIFIED");

    const audit = membershipAudits.find(
      (record) =>
        record.actorUserId === actor.id && record.targetUserId === member.id,
    );
    assert.ok(audit);
    assert.equal(audit.actorUserId, actor.id);
    assert.equal(audit.targetUserId, member.id);
    assert.equal(audit.fromStatus, "NEED_REVIEW");
    assert.equal(audit.toStatus, "VERIFIED");
    assert.equal(audit.reason, "Payment proof approved");
    assert.ok(audit.createdAt instanceof Date);
  }
});

test("membership status endpoint requires a reason when declining a NEED_REVIEW payment proof", async () => {
  const member = storeUser(
    makeUser({ email: "member@example.com", membershipStatus: "NEED_REVIEW" }),
  );
  const actor = storeUser(
    makeUser({ email: "admin@example.com", role: "ADMIN", isVerified: true }),
  );

  const response = await requestApp(createApp(), {
    method: "POST",
    path: `/api/auth/admin/members/${member.id}/status`,
    token: authToken(actor),
    body: {
      status: "INACTIVE",
      reason: "   ",
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(
    response.json.error,
    "Decline reason is required for payment proof decline",
  );
  assert.equal(usersById.get(member.id)?.membershipStatus, "NEED_REVIEW");
  assert.equal(membershipAudits.length, 0);
  assert.equal(declinedPaymentProofEmails.length, 0);
});

test("membership status endpoint rejects decline reasons over the audit limit", async () => {
  const member = storeUser(
    makeUser({ email: "member@example.com", membershipStatus: "NEED_REVIEW" }),
  );
  const actor = storeUser(
    makeUser({ email: "admin@example.com", role: "ADMIN", isVerified: true }),
  );

  const response = await requestApp(createApp(), {
    method: "POST",
    path: `/api/auth/admin/members/${member.id}/status`,
    token: authToken(actor),
    body: {
      status: "INACTIVE",
      reason: "x".repeat(201),
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json.error, "Reason must be 200 characters or fewer");
  assert.equal(usersById.get(member.id)?.membershipStatus, "NEED_REVIEW");
  assert.equal(membershipAudits.length, 0);
});

test("membership status endpoint allows ADMIN or OWNER to decline NEED_REVIEW users, audits the reason, and sends email", async () => {
  globalThis.__AUSS_AUTH_TEST_HOOKS__ = {
    sendPaymentProofDeclinedEmail: async (payload) => {
      declinedPaymentProofEmails.push(payload);
    },
  };

  for (const actorRole of ["ADMIN", "OWNER"]) {
    const member = storeUser(
      makeUser({
        id: `decline-${actorRole.toLowerCase()}-member`,
        email: `decline-${actorRole.toLowerCase()}@example.com`,
        membershipStatus: "NEED_REVIEW",
        info: {
          id: `info-decline-${actorRole.toLowerCase()}`,
          userId: `decline-${actorRole.toLowerCase()}-member`,
          firstName: "Cash",
          lastName: "Member",
        },
      }),
    );
    const actor = storeUser(
      makeUser({
        email: `${actorRole.toLowerCase()}-decliner@example.com`,
        role: actorRole,
        isVerified: true,
      }),
    );
    const reason = `Receipt total is unreadable for ${actorRole}`;

    const response = await requestApp(createApp(), {
      method: "POST",
      path: `/api/auth/admin/members/${member.id}/status`,
      token: authToken(actor),
      body: {
        status: "INACTIVE",
        reason,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(usersById.get(member.id)?.membershipStatus, "INACTIVE");
    assert.equal(response.json.data.membershipStatus, "INACTIVE");

    const audit = membershipAudits.find(
      (record) =>
        record.actorUserId === actor.id && record.targetUserId === member.id,
    );
    assert.ok(audit);
    assert.equal(audit.actorUserId, actor.id);
    assert.equal(audit.targetUserId, member.id);
    assert.equal(audit.fromStatus, "NEED_REVIEW");
    assert.equal(audit.toStatus, "INACTIVE");
    assert.equal(audit.reason, reason);
    assert.ok(audit.createdAt instanceof Date);

    const email = declinedPaymentProofEmails.find(
      (record) => record.to === member.email,
    );
    assert.ok(email);
    assert.equal(email.reason, reason);
    assert.match(email.subject, /Payment Proof Declined/);
    assert.match(email.text, /payment proof was reviewed and declined/i);
    assert.match(email.text, new RegExp(reason));
    assert.equal(email.text.includes("fileBytes"), false);
    assert.equal(email.html.includes("fileBytes"), false);
    assert.equal(email.text.includes("receipt.png"), false);
    assert.equal(email.html.includes("receipt.png"), false);
  }
});

test("decline email uses the shared SMTP mailer path when SMTP is configured", async () => {
  const sentMessages = [];
  process.env.SMTP_USER = "mailer@example.com";
  process.env.SMTP_PASS = "test-password";
  process.env.SMTP_FROM = "AUSS <noreply@example.com>";
  globalThis.__AUSS_AUTH_TEST_HOOKS__ = {
    sendMail: async (message) => {
      sentMessages.push(message);
    },
  };

  const member = storeUser(
    makeUser({
      email: "decline-mailer@example.com",
      membershipStatus: "NEED_REVIEW",
      info: {
        id: "info-decline-mailer",
        userId: "decline-mailer-member",
        firstName: "Mailer",
        lastName: "Member",
      },
    }),
  );
  const actor = storeUser(
    makeUser({ email: "admin@example.com", role: "ADMIN", isVerified: true }),
  );
  const reason = "The receipt does not show the correct bank reference.";

  const response = await requestApp(createApp(), {
    method: "POST",
    path: `/api/auth/admin/members/${member.id}/status`,
    token: authToken(actor),
    body: {
      status: "INACTIVE",
      reason,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].from, "AUSS <noreply@example.com>");
  assert.equal(sentMessages[0].to, member.email);
  assert.match(sentMessages[0].subject, /Payment Proof Declined/);
  assert.match(sentMessages[0].text, new RegExp(reason));
  assert.match(sentMessages[0].html, /Auckland Uni Strength Society/);
});

test("decline email failure does not roll back the audited status transition", async () => {
  let attempted = false;
  globalThis.__AUSS_AUTH_TEST_HOOKS__ = {
    sendPaymentProofDeclinedEmail: async () => {
      attempted = true;
      throw new Error("SMTP delivery failed");
    },
  };

  const member = storeUser(
    makeUser({
      email: "delivery-failure@example.com",
      membershipStatus: "NEED_REVIEW",
    }),
  );
  const actor = storeUser(
    makeUser({ email: "admin@example.com", role: "ADMIN", isVerified: true }),
  );

  const response = await requestApp(createApp(), {
    method: "POST",
    path: `/api/auth/admin/members/${member.id}/status`,
    token: authToken(actor),
    body: {
      status: "INACTIVE",
      reason: "The uploaded proof is not readable.",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(attempted, true);
  assert.equal(usersById.get(member.id)?.membershipStatus, "INACTIVE");
  assert.equal(response.json.data.membershipStatus, "INACTIVE");
  assert.equal(
    response.json.warning,
    "Payment proof declined, but email notification could not be sent.",
  );

  const audit = membershipAudits.find(
    (record) =>
      record.actorUserId === actor.id && record.targetUserId === member.id,
  );
  assert.ok(audit);
  assert.equal(audit.fromStatus, "NEED_REVIEW");
  assert.equal(audit.toStatus, "INACTIVE");
});

test("approval does not send a payment proof decline email", async () => {
  let declineEmailCalls = 0;
  let mailerCalls = 0;
  process.env.SMTP_USER = "mailer@example.com";
  process.env.SMTP_PASS = "test-password";
  globalThis.__AUSS_AUTH_TEST_HOOKS__ = {
    sendPaymentProofDeclinedEmail: async () => {
      declineEmailCalls += 1;
    },
    sendMail: async () => {
      mailerCalls += 1;
    },
  };

  const member = storeUser(
    makeUser({ email: "approval@example.com", membershipStatus: "NEED_REVIEW" }),
  );
  const actor = storeUser(
    makeUser({ email: "admin@example.com", role: "ADMIN", isVerified: true }),
  );

  const response = await requestApp(createApp(), {
    method: "POST",
    path: `/api/auth/admin/members/${member.id}/status`,
    token: authToken(actor),
    body: {
      status: "VERIFIED",
      reason: "Payment proof approved",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(usersById.get(member.id)?.membershipStatus, "VERIFIED");
  assert.equal(declineEmailCalls, 0);
  assert.equal(mailerCalls, 0);
});

test("membership status endpoint rejects illegal transitions", async () => {
  const member = storeUser(
    makeUser({ email: "inactive@example.com", membershipStatus: "INACTIVE" }),
  );
  const actor = storeUser(
    makeUser({ email: "admin@example.com", role: "ADMIN", isVerified: true }),
  );

  const response = await requestApp(createApp(), {
    method: "POST",
    path: `/api/auth/admin/members/${member.id}/status`,
    token: authToken(actor),
    body: {
      status: "VERIFIED",
      reason: "Payment proof approved",
    },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json.error, "Illegal transition: INACTIVE → VERIFIED");
});

test("admin roster reflects VERIFIED status after approval", async () => {
  const member = storeUser(
    makeUser({
      id: "roster-review-user",
      email: "roster.review@example.com",
      membershipStatus: "NEED_REVIEW",
      info: {
        id: "info-roster-review-user",
        userId: "roster-review-user",
        firstName: "Roster",
        lastName: "Review",
      },
    }),
  );
  const actor = storeUser(
    makeUser({ email: "admin@example.com", role: "ADMIN", isVerified: true }),
  );

  const approveResponse = await requestApp(createApp(), {
    method: "POST",
    path: `/api/auth/admin/members/${member.id}/status`,
    token: authToken(actor),
    body: {
      status: "VERIFIED",
      reason: "Payment proof approved",
    },
  });

  assert.equal(approveResponse.statusCode, 200);

  const rosterResponse = await requestApp(createApp(), {
    path: "/api/auth/admin/members?status=VERIFIED&page=1&pageSize=20",
    token: authToken(actor),
  });

  assert.equal(rosterResponse.statusCode, 200);
  assert.ok(
    rosterResponse.json.data.some(
      (row) => row.id === member.id && row.membershipStatus === "VERIFIED",
    ),
  );
});
