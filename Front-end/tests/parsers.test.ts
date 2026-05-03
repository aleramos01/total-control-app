import test from 'node:test';
import assert from 'node:assert/strict';
import { TransactionType } from '../types.js';
import { parseAuthStatusResponse, parseCurrentUserResponse, parseImportFilePayload, parseTransactionsResponse } from '../services/parsers.js';

test('parseCurrentUserResponse rejects malformed payloads', () => {
  assert.throws(
    () => parseCurrentUserResponse({ user: { id: 1 } }),
    /Invalid user payload/,
  );
});

test('parseAuthStatusResponse returns typed auth status', () => {
  const response = parseAuthStatusResponse({ publicRegistrationOpen: false });

  assert.equal(response.publicRegistrationOpen, false);
});

test('parseTransactionsResponse returns typed transactions', () => {
  const response = parseTransactionsResponse({
    transactions: [
      {
        id: 'txn_1',
        description: 'Internet',
        amount: 99.9,
        date: '2026-01-01T00:00:00.000Z',
        type: TransactionType.EXPENSE,
        category: 'housing',
        scheduleType: 'recurring',
        isRecurring: true,
        isPaid: false,
        dueDate: '2026-01-10T00:00:00.000Z',
        notes: null,
      },
    ],
  });

  assert.equal(response.transactions[0].scheduleType, 'recurring');
});

test('parseImportFilePayload accepts missing arrays as empty lists', () => {
  const payload = parseImportFilePayload({});

  assert.deepEqual(payload, {
    transactions: [],
    categories: [],
  });
});
