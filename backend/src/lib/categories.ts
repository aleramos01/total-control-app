export const BUILT_IN_CATEGORY_KEYS = [
  'salary',
  'food',
  'transport',
  'car',
  'housing',
  'leisure',
  'health',
  'education',
  'investments',
  'other',
] as const;

export const DEFAULT_CATEGORY_KEY = 'other';

export function buildCategoryKey(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeCategoryKey(value: string) {
  return buildCategoryKey(value) || DEFAULT_CATEGORY_KEY;
}

export function buildUniqueCategoryKey(preferredKey: string, existingKeys: Iterable<string>) {
  const normalizedKey = normalizeCategoryKey(preferredKey);
  const keys = new Set(existingKeys);

  if (!keys.has(normalizedKey)) {
    return normalizedKey;
  }

  let suffix = 2;
  while (keys.has(`${normalizedKey}_${suffix}`)) {
    suffix += 1;
  }

  return `${normalizedKey}_${suffix}`;
}

export function isBuiltInCategoryKey(key: string) {
  return (BUILT_IN_CATEGORY_KEYS as readonly string[]).includes(key);
}

export function resolveImportedTransactionCategory(categoryKey: string, availableCustomKeys: Set<string>) {
  if (availableCustomKeys.has(categoryKey) || isBuiltInCategoryKey(categoryKey)) {
    return categoryKey;
  }

  return DEFAULT_CATEGORY_KEY;
}
