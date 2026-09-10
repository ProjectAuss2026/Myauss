import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/test";

// Minimal but structurally valid image headers — the magic bytes are what the
// browser (and this test) actually keys off.
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01,
]);
const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

// CRITICAL: Prisma returns `Bytes` as a Uint8Array, NOT a Node Buffer (verified
// against a live query: constructor === Uint8Array, Buffer.isBuffer() === false).
// This fixture must keep that shape — passing a Buffer here would hide the bug
// that broke every uploaded image, because res.send() only writes raw bytes for
// Buffers and JSON-stringifies everything else.
const stored = {
  "png-id": { id: "png-id", mimeType: "image/png", fileBytes: new Uint8Array(PNG_BYTES) },
  "jpeg-id": { id: "jpeg-id", mimeType: "image/jpeg", fileBytes: new Uint8Array(JPEG_BYTES) },
};

globalThis.prisma = {
  uploadedImage: {
    findUnique: async ({ where }) => stored[where.id] ?? null,
  },
};

const { serveUploadedImage } = await import("./uploadController.js");

function get(server, path) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path }, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }),
        );
      })
      .on("error", reject);
  });
}

async function withServer(run) {
  const app = express();
  app.get("/api/upload/:id", serveUploadedImage);
  const server = app.listen(0);
  try {
    return await run(server);
  } finally {
    server.close();
  }
}

// Regression: this returned 200 OK with the byte array JSON-stringified into
// {"0":137,"1":80,...} — undecodable as an image, so every uploaded image
// rendered broken in prod while the status code looked healthy.
test("GET /api/upload/:id returns raw image bytes, not a JSON-stringified array", async () => {
  await withServer(async (server) => {
    const { status, headers, body } = await get(server, "/api/upload/png-id");

    assert.equal(status, 200);
    assert.match(headers["content-type"] ?? "", /^image\/png/);
    assert.notEqual(
      body.subarray(0, 1).toString(),
      "{",
      "body must not be JSON — res.send() was given a non-Buffer and serialised it",
    );
    assert.equal(
      body.subarray(0, 8).toString("hex"),
      "89504e470d0a1a0a",
      "must start with the PNG magic bytes",
    );
    assert.equal(body.length, PNG_BYTES.length, "byte length must match the stored image exactly");
    assert.equal(body.equals(PNG_BYTES), true, "bytes must round-trip unchanged");
  });
});

test("GET /api/upload/:id preserves the stored mime type and raw bytes for other formats", async () => {
  await withServer(async (server) => {
    const { status, headers, body } = await get(server, "/api/upload/jpeg-id");

    assert.equal(status, 200);
    assert.match(headers["content-type"] ?? "", /^image\/jpeg/);
    assert.equal(body.subarray(0, 3).toString("hex"), "ffd8ff", "JPEG magic bytes");
    assert.equal(body.equals(JPEG_BYTES), true);
  });
});

test("GET /api/upload/:id still 404s for an unknown id", async () => {
  await withServer(async (server) => {
    const { status, body } = await get(server, "/api/upload/does-not-exist");

    assert.equal(status, 404);
    assert.match(body.toString(), /Image not found/);
  });
});
