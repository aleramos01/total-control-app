import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCategoryKey,
  buildUniqueCategoryKey,
  normalizeCategoryKey,
  resolveImportedTransactionCategory,
} from './categories.js';

test('buildCategoryKey normalizes accents and spacing', () => {
  assert.equal(buildCategoryKey('Cartão de Crédito'), 'cartao_de_credito');
});

test('buildCategoryKey trims separators from edges', () => {
  assert.equal(buildCategoryKey('  ## Assinaturas ++  '), 'assinaturas');
});

test('buildUniqueCategoryKey appends a numeric suffix when needed', () => {
  assert.equal(buildUniqueCategoryKey('assinaturas', ['assinaturas', 'assinaturas_2']), 'assinaturas_3');
});

test('normalizeCategoryKey falls back to other for empty input', () => {
  assert.equal(normalizeCategoryKey('###'), 'other');
});

test('resolveImportedTransactionCategory falls back to other for unknown custom keys', () => {
  assert.equal(resolveImportedTransactionCategory('legacy_missing_key', new Set(['assinaturas'])), 'other');
  assert.equal(resolveImportedTransactionCategory('food', new Set()), 'food');
});
