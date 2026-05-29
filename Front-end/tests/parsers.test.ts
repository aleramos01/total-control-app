import test from 'node:test';
import assert from 'node:assert/strict';
import { TransactionType } from '../types.js';
import {
  parseAppSettingsResponse,
  parseAuthStatusResponse,
  parseBrandSettingsResponse,
  parseCurrentUserResponse,
  parseImportFilePayload,
  parseInviteResponse,
  parseTransactionsResponse,
} from '../services/parsers.js';

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

test('parseInviteResponse accepts function payloads with camelCase timestamps', () => {
  const response = parseInviteResponse({
    invite: {
      code: 'ABC123XYZ',
      createdAt: '2026-05-03T18:00:00.000Z',
      expiresAt: '2026-05-17T18:00:00.000Z',
    },
  });

  assert.equal(response.invite.code, 'ABC123XYZ');
  assert.equal(response.invite.expiresAt, '2026-05-17T18:00:00.000Z');
});

test('parseBrandSettingsResponse keeps nullable visual fields typed', () => {
  const response = parseBrandSettingsResponse({
    settings: {
      productName: 'Total Control',
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#123456',
      accentColor: '#654321',
      surfaceColor: '#ffffff',
      textColor: '#111111',
      supportEmail: null,
      marketingHeadline: 'Controle financeiro sem planilha',
    },
  });

  assert.equal(response.settings.productName, 'Total Control');
  assert.equal(response.settings.logoUrl, null);
  assert.equal(response.settings.supportEmail, null);
});

test('parseAppSettingsResponse rejects malformed settings payloads', () => {
  assert.throws(
    () => parseAppSettingsResponse({
      settings: {
        currency: 'USD',
        locale: 'en-US',
        timezone: 'America/New_York',
        billingDayDefault: '10',
      },
    }),
    /Invalid app settings payload/,
  );
});

test('parseImportFilePayload accepts missing arrays as empty lists', () => {
  const payload = parseImportFilePayload({});

  assert.deepEqual(payload, {
    transactions: [],
    categories: [],
  });
});

test('parseImportFilePayload keeps categories and transactions ready for preview', () => {
  const payload = parseImportFilePayload({
    exportedAt: '2026-05-17T12:00:00.000Z',
    categories: [
      { key: 'subscriptions', name: 'Subscriptions', color: '#123456' },
    ],
    transactions: [
      {
        description: 'Netflix',
        amount: 39.9,
        date: '2026-05-10T00:00:00.000Z',
        type: TransactionType.EXPENSE,
        category: 'subscriptions',
        isPaid: true,
      },
    ],
  });

  assert.equal(payload.categories[0]?.key, 'subscriptions');
  assert.equal(payload.transactions[0]?.description, 'Netflix');
  assert.equal(payload.transactions[0]?.type, TransactionType.EXPENSE);
});
