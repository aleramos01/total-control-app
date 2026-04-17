import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, createId, createSessionToken, sha256 } from './utils.js';

test('createId prefixes the generated identifier', () => {
  const id = createId('txn');
  assert.match(id, /^txn_/);
});

test('createSessionToken returns a 64-char hex token', () => {
  const token = createSessionToken();
  assert.equal(token.length, 64);
  assert.match(token, /^[a-f0-9]+$/);
});

test('sha256 is deterministic', () => {
  assert.equal(sha256('total-control'), sha256('total-control'));
  assert.notEqual(sha256('total-control'), sha256('another-value'));
});

test('addDays returns a future ISO string', () => {
  const future = addDays(2);
  assert.ok(Date.parse(future) > Date.now());
});
