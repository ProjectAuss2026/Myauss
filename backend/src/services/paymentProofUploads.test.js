import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/test";

globalThis.prisma = {};

const {
  cleanupExpiredPendingPaymentProofUploads,
  getPendingPaymentProofRetentionHours,
  PAYMENT_PROOF_UPLOAD_STATUS,
} = await import("./paymentProofUploads.js");

function createClient(uploads) {
  return {
    paymentProofUpload: {
      findMany: async ({ where }) =>
        uploads.filter((upload) => {
          if (where.status && upload.status !== where.status) return false;
          if (where.userId === null && upload.userId !== null) return false;
          if (where.linkedAt === null && upload.linkedAt !== null) return false;
          if (where.expiresAt?.lt && !(upload.expiresAt < where.expiresAt.lt)) {
            return false;
          }
          return true;
        }),
      deleteMany: async ({ where }) => {
        const removableIds = new Set(where.id.in);
        let count = 0;
        for (let index = uploads.length - 1; index >= 0; index -= 1) {
          if (!removableIds.has(uploads[index].id)) continue;
          uploads.splice(index, 1);
          count += 1;
        }
        return { count };
      },
    },
  };
}
test.afterEach(() => {
  delete process.env.PAYMENT_PROOF_UPLOAD_RETENTION_HOURS;
});

test("getPendingPaymentProofRetentionHours defaults to 24 when unset", () => {
  delete process.env.PAYMENT_PROOF_UPLOAD_RETENTION_HOURS;
  assert.equal(getPendingPaymentProofRetentionHours(), 24);
});

test("getPendingPaymentProofRetentionHours honours a valid override", () => {
  process.env.PAYMENT_PROOF_UPLOAD_RETENTION_HOURS = "48";
  assert.equal(getPendingPaymentProofRetentionHours(), 48);
});

test("cleanupExpiredPendingPaymentProofUploads removes expired unlinked uploads and keeps linked proofs", async () => {
  const expiredPending = {
    id: "expired-proof",
    status: PAYMENT_PROOF_UPLOAD_STATUS.PENDING,
    userId: null,
    linkedAt: null,
    expiresAt: new Date(Date.now() - 60_000),
  };
  const linkedProof = {
    id: "linked-proof",
    status: PAYMENT_PROOF_UPLOAD_STATUS.LINKED,
    userId: "user-1",
    linkedAt: new Date(),
    expiresAt: new Date(Date.now() - 60_000),
  };
  const uploads = [expiredPending, linkedProof];
  const client = createClient(uploads);

  const deletedCount = await cleanupExpiredPendingPaymentProofUploads(
    new Date(),
    client,
  );

  assert.equal(deletedCount, 1);
  assert.equal(
    uploads.some((upload) => upload.id === expiredPending.id),
    false,
  );
  assert.equal(
    uploads.some((upload) => upload.id === linkedProof.id),
    true,
  );
});
