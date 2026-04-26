export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function normalizeCategoryKey(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'other';
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

export function resolveImportedTransactionCategory(categoryKey: string, availableCustomKeys: Set<string>) {
  const builtIn = new Set([
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
  ]);

  if (availableCustomKeys.has(categoryKey) || builtIn.has(categoryKey)) {
    return categoryKey;
  }

  return 'other';
}
