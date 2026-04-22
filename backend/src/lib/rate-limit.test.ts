import test from 'node:test';
import assert from 'node:assert/strict';
import { clearRateLimitStore, enforceRateLimit } from './rate-limit.js';

test('enforceRateLimit blocks requests after the configured limit', async () => {
  clearRateLimitStore();

  const request = { ip: '127.0.0.1' };
  const reply = {
    headers: new Map<string, string>(),
    statusCode: 200,
    payload: null as unknown,
    header(name: string, value: string) {
      this.headers.set(name, value);
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };

  const first = await enforceRateLimit(request as never, reply as never, {
    key: 'unit-test',
    limit: 1,
    windowMs: 1_000,
  });
  const second = await enforceRateLimit(request as never, reply as never, {
    key: 'unit-test',
    limit: 1,
    windowMs: 1_000,
    errorMessage: 'Blocked',
  });

  assert.equal(first, true);
  assert.equal(second, false);
  assert.equal(reply.statusCode, 429);
  assert.deepEqual(reply.payload, { message: 'Blocked' });
});
