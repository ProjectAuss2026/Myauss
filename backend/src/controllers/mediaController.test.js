import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';
globalThis.prisma ||= {};

const { fetchPinnedPublicHttpUrl } = await import('./mediaController.js');

function createMockHttpRequest({ chunks = [], headers = {}, statusCode = 200, capture = {} }) {
  return (_options, callback) => {
    const req = new EventEmitter();
    req.destroy = () => {
      capture.requestDestroyed = true;
      return req;
    };
    req.end = () => {
      const response = new EventEmitter();
      response.statusCode = statusCode;
      response.headers = headers;
      response.destroy = () => {
        capture.responseDestroyed = true;
        return response;
      };

      callback(response);

      queueMicrotask(() => {
        for (const chunk of chunks) {
          if (capture.responseDestroyed) break;
          response.emit('data', Buffer.from(chunk));
        }
        if (!capture.responseDestroyed) response.emit('end');
      });
    };
    return req;
  };
}

async function withMockedHttpRequest(mockRequest, callback) {
  const originalRequest = http.request;
  http.request = mockRequest;
  try {
    await callback();
  } finally {
    http.request = originalRequest;
  }
}

test('fetchPinnedPublicHttpUrl returns the existing response shape under maxBytes', async () => {
  await withMockedHttpRequest(
    createMockHttpRequest({ chunks: ['hello'], statusCode: 200 }),
    async () => {
      const response = await fetchPinnedPublicHttpUrl('http://93.184.216.34/small', { maxBytes: 5 });

      assert.equal(response.ok, true);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'hello');
    }
  );
});

test('fetchPinnedPublicHttpUrl destroys and rejects responses that exceed maxBytes while streaming', async () => {
  const capture = { requestDestroyed: false, responseDestroyed: false };

  await withMockedHttpRequest(
    createMockHttpRequest({ chunks: ['abcd', 'efgh'], capture }),
    async () => {
      await assert.rejects(
        fetchPinnedPublicHttpUrl('http://93.184.216.34/large', { maxBytes: 5 }),
        { message: 'Response body too large.' }
      );
    }
  );

  assert.equal(capture.responseDestroyed, true);
  assert.equal(capture.requestDestroyed, true);
});

test('fetchPinnedPublicHttpUrl rejects early when content-length exceeds maxBytes', async () => {
  const capture = { requestDestroyed: false, responseDestroyed: false };

  await withMockedHttpRequest(
    createMockHttpRequest({
      chunks: ['small'],
      headers: { 'content-length': '6' },
      capture,
    }),
    async () => {
      await assert.rejects(
        fetchPinnedPublicHttpUrl('http://93.184.216.34/declared-large', { maxBytes: 5 }),
        { message: 'Response body too large.' }
      );
    }
  );

  assert.equal(capture.responseDestroyed, true);
  assert.equal(capture.requestDestroyed, true);
});