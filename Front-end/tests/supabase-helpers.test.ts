import test from 'node:test';
import assert from 'node:assert/strict';
import { TransactionType } from '../types.js';
import { buildCategoryInsertRow, buildTransactionInsertRows, mapTransactionRow } from '../services/supabase-helpers.js';

test('buildTransactionInsertRows creates one row per installment and preserves series linkage', () => {
  const rows = buildTransactionInsertRows('user_1', {
    description: 'Notebook',
    amount: 300,
    date: '2026-01-10T00:00:00.000Z',
    type: TransactionType.EXPENSE,
    category: 'education',
    scheduleType: 'installment',
    installmentCount: 3,
    isRecurring: false,
    dueDate: '2026-01-15T00:00:00.000Z',
    isPaid: false,
    notes: 'Compra parcelada',
  }, '2026-01-01T00:00:00.000Z');

  assert.equal(rows.length, 3);
  assert.equal(rows[0].installment_index, 1);
  assert.equal(rows[1].installment_index, 2);
  assert.equal(rows[2].installment_index, 3);
  assert.equal(rows[0].series_id, rows[1].series_id);
  assert.equal(rows[1].series_id, rows[2].series_id);
  assert.match(rows[1].description, /\(2\/3\)$/);
});

test('mapTransactionRow converts database columns to app transaction shape', () => {
  const transaction = mapTransactionRow({
    id: 'txn_1',
    user_id: 'user_1',
    description: 'Internet',
    amount: 99.9,
    type: 'expense',
    category_key: 'housing',
    transaction_date: '2026-01-01T00:00:00.000Z',
    schedule_type: 'recurring',
    series_id: null,
    installment_index: null,
    installment_count: null,
    is_recurring: true,
    due_date: '2026-01-10T00:00:00.000Z',
    is_paid: false,
    notes: null,
  });

  assert.equal(transaction.category, 'housing');
  assert.equal(transaction.scheduleType, 'recurring');
  assert.equal(transaction.dueDate, '2026-01-10T00:00:00.000Z');
});

test('buildCategoryInsertRow generates a unique normalized key', () => {
  const category = buildCategoryInsertRow('user_1', {
    name: 'Assinaturas Adobe',
    color: '#123456',
  }, ['assinaturas_adobe']);

  assert.equal(category.key, 'assinaturas_adobe_2');
  assert.equal(category.user_id, 'user_1');
});
