import test from 'node:test';
import assert from 'node:assert/strict';
import { categorySchema, registerSchema, transactionSchema } from './validators.js';

test('registerSchema accepts valid input', () => {
  const parsed = registerSchema.safeParse({
    name: 'Maria Silva',
    email: 'maria@example.com',
    password: 'senha-super-segura',
  });

  assert.equal(parsed.success, true);
});

test('registerSchema rejects invalid email', () => {
  const parsed = registerSchema.safeParse({
    name: 'Maria Silva',
    email: 'maria',
    password: 'senha-super-segura',
  });

  assert.equal(parsed.success, false);
});

test('transactionSchema applies sensible defaults', () => {
  const parsed = transactionSchema.parse({
    description: 'Mensalidade',
    amount: 120,
    date: new Date('2026-01-10').toISOString(),
    type: 'expense',
    category: 'subscriptions',
  });

  assert.equal(parsed.isRecurring, false);
  assert.equal(parsed.isPaid, false);
});

test('transactionSchema rejects negative amounts', () => {
  const parsed = transactionSchema.safeParse({
    description: 'Mensalidade',
    amount: -1,
    date: new Date('2026-01-10').toISOString(),
    type: 'expense',
    category: 'subscriptions',
  });

  assert.equal(parsed.success, false);
});

test('categorySchema accepts an optional stable key for imports', () => {
  const parsed = categorySchema.safeParse({
    key: 'assinaturas',
    name: 'Assinaturas',
    color: '#123456',
  });

  assert.equal(parsed.success, true);
});
