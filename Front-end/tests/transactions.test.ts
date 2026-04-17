import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTransactionQuery, buildTransactionsCsv, getUpcomingBills, parseStoredDate, suggestCategoryFromDescription } from '../lib/transactions.js';
import { TransactionType, type Transaction } from '../types.js';

test('buildTransactionQuery only serializes filled filters', () => {
  const query = buildTransactionQuery({
    q: 'mercado',
    type: TransactionType.EXPENSE,
    from: '2026-01-01',
    to: '2026-01-31',
  });

  assert.match(query, /^\?/);
  assert.match(query, /q=mercado/);
  assert.match(query, /type=expense/);
  assert.match(query, /from=2026-01-01T00%3A00%3A00.000Z/);
  assert.match(query, /to=2026-01-31T00%3A00%3A00.000Z/);
});

test('buildTransactionsCsv escapes quotes and resolves category labels', () => {
  const csv = buildTransactionsCsv(
    [
      {
        id: 'txn_1',
        description: 'Plano "Pro"',
        amount: 99.9,
        date: '2026-01-10T00:00:00.000Z',
        type: TransactionType.EXPENSE,
        category: 'subscriptions',
        isPaid: false,
      },
    ],
    {
      subscriptions: { name: 'Assinaturas' },
    }
  );

  assert.match(csv, /"Plano ""Pro"""/);
  assert.match(csv, /"Assinaturas"/);
});

test('getUpcomingBills keeps recurring expenses due within 30 days sorted by nearest due date', () => {
  const transactions: Transaction[] = [
    {
      id: '1',
      description: 'Internet',
      amount: 100,
      date: '2026-01-01T00:00:00.000Z',
      dueDate: '2026-01-15T00:00:00.000Z',
      type: TransactionType.EXPENSE,
      category: 'housing',
      isRecurring: true,
      isPaid: false,
    },
    {
      id: '2',
      description: 'Salario',
      amount: 3000,
      date: '2026-01-01T00:00:00.000Z',
      type: TransactionType.INCOME,
      category: 'salary',
    },
    {
      id: '3',
      description: 'Plano anual',
      amount: 200,
      date: '2026-01-01T00:00:00.000Z',
      dueDate: '2026-03-20T00:00:00.000Z',
      type: TransactionType.EXPENSE,
      category: 'other',
      isRecurring: true,
      isPaid: false,
    },
    {
      id: '4',
      description: 'Celular',
      amount: 80,
      date: '2026-01-01T00:00:00.000Z',
      dueDate: '2026-01-08T00:00:00.000Z',
      type: TransactionType.EXPENSE,
      category: 'other',
      isRecurring: true,
      isPaid: false,
    },
  ];

  const upcoming = getUpcomingBills(transactions, new Date('2026-01-05T12:00:00.000Z'));

  assert.deepEqual(upcoming.map(item => item.id), ['4', '1']);
  assert.deepEqual(upcoming.map(item => item.diffDays), [3, 10]);
});

test('parseStoredDate preserves the day portion of stored ISO strings', () => {
  const parsed = parseStoredDate('2026-01-08T00:00:00.000Z');
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 0);
  assert.equal(parsed.getDate(), 8);
});

test('suggestCategoryFromDescription infers an expense category from the description', () => {
  const category = suggestCategoryFromDescription(
    'Uber aeroporto',
    TransactionType.EXPENSE,
    {
      transport: { name: 'Transporte' },
      other: { name: 'Outros' },
    },
    ['transport', 'other'],
  );

  assert.equal(category, 'transport');
});

test('suggestCategoryFromDescription infers an income category from the description', () => {
  const category = suggestCategoryFromDescription(
    'Salario empresa abril',
    TransactionType.INCOME,
    {
      salary: { name: 'Salário' },
      investments: { name: 'Investimentos' },
      other: { name: 'Outros' },
    },
    ['salary', 'investments', 'other'],
  );

  assert.equal(category, 'salary');
});

test('suggestCategoryFromDescription matches custom categories by name before built-in fallback', () => {
  const category = suggestCategoryFromDescription(
    'Assinatura Adobe mensal',
    TransactionType.EXPENSE,
    {
      subscriptions_custom: { name: 'Assinatura Adobe' },
      leisure: { name: 'Lazer' },
      other: { name: 'Outros' },
    },
    ['subscriptions_custom', 'leisure', 'other'],
  );

  assert.equal(category, 'subscriptions_custom');
});

test('suggestCategoryFromDescription maps pharmacy expenses to health', () => {
  const category = suggestCategoryFromDescription(
    'Farmacia drogasil',
    TransactionType.EXPENSE,
    {
      health: { name: 'Saúde' },
      other: { name: 'Outros' },
    },
    ['health', 'other'],
  );

  assert.equal(category, 'health');
});

test('suggestCategoryFromDescription maps client pix income to salary bucket', () => {
  const category = suggestCategoryFromDescription(
    'Pix cliente projeto site',
    TransactionType.INCOME,
    {
      salary: { name: 'Salário' },
      other: { name: 'Outros' },
    },
    ['salary', 'other'],
  );

  assert.equal(category, 'salary');
});

test('suggestCategoryFromDescription maps dividends to investments', () => {
  const category = suggestCategoryFromDescription(
    'Dividendo fii agosto',
    TransactionType.INCOME,
    {
      salary: { name: 'Salário' },
      investments: { name: 'Investimentos' },
      other: { name: 'Outros' },
    },
    ['salary', 'investments', 'other'],
  );

  assert.equal(category, 'investments');
});
