import { type AppSettings, type AuthStatus, type BrandSettings, type CustomCategory, type ExportPayload, type InviteInfo, type Transaction, TransactionType, type TransactionScheduleType, transactionScheduleTypes, type User } from '../types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTransactionType(value: unknown): value is TransactionType {
  return value === TransactionType.INCOME || value === TransactionType.EXPENSE;
}

function isScheduleType(value: unknown): value is TransactionScheduleType {
  return typeof value === 'string' && transactionScheduleTypes.includes(value as TransactionScheduleType);
}

function parseRecord(value: unknown, errorMessage: string) {
  if (!isObject(value)) {
    throw new Error(errorMessage);
  }
  return value;
}

function parseUser(value: unknown): User {
  const record = parseRecord(value, 'Invalid user payload');
  if (!isString(record.id) || !isString(record.name) || !isString(record.email) || (record.role !== 'admin' && record.role !== 'user')) {
    throw new Error('Invalid user payload');
  }

  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
  };
}

function parseTransaction(value: unknown): Transaction {
  const record = parseRecord(value, 'Invalid transaction payload');

  if (
    !isString(record.id)
    || !isString(record.description)
    || !isNumber(record.amount)
    || !isString(record.date)
    || !isTransactionType(record.type)
    || !isString(record.category)
  ) {
    throw new Error('Invalid transaction payload');
  }

  if (record.scheduleType !== undefined && !isScheduleType(record.scheduleType)) {
    throw new Error('Invalid transaction payload');
  }

  if (!isNullableString(record.seriesId) || !isNullableString(record.dueDate) || !isNullableString(record.notes)) {
    throw new Error('Invalid transaction payload');
  }

  if (
    (record.installmentIndex !== undefined && record.installmentIndex !== null && !isNumber(record.installmentIndex))
    || (record.installmentCount !== undefined && record.installmentCount !== null && !isNumber(record.installmentCount))
    || (record.isRecurring !== undefined && !isBoolean(record.isRecurring))
    || (record.isPaid !== undefined && !isBoolean(record.isPaid))
  ) {
    throw new Error('Invalid transaction payload');
  }

  return {
    id: record.id,
    description: record.description,
    amount: record.amount,
    date: record.date,
    type: record.type,
    category: record.category,
    scheduleType: record.scheduleType,
    seriesId: record.seriesId ?? null,
    installmentIndex: record.installmentIndex ?? null,
    installmentCount: record.installmentCount ?? null,
    isRecurring: record.isRecurring,
    dueDate: record.dueDate ?? null,
    isPaid: record.isPaid,
    notes: record.notes ?? null,
  };
}

function parseCustomCategory(value: unknown): CustomCategory {
  const record = parseRecord(value, 'Invalid category payload');
  if (!isString(record.id) || !isString(record.key) || !isString(record.name) || !isString(record.color)) {
    throw new Error('Invalid category payload');
  }

  return {
    id: record.id,
    key: record.key,
    name: record.name,
    color: record.color,
  };
}

function parseBrandSettings(value: unknown): BrandSettings {
  const record = parseRecord(value, 'Invalid brand settings payload');
  if (
    !isString(record.productName)
    || !isNullableString(record.logoUrl)
    || !isNullableString(record.faviconUrl)
    || !isString(record.primaryColor)
    || !isString(record.accentColor)
    || !isString(record.surfaceColor)
    || !isString(record.textColor)
    || !isNullableString(record.supportEmail)
    || !isString(record.marketingHeadline)
  ) {
    throw new Error('Invalid brand settings payload');
  }

  return {
    productName: record.productName,
    logoUrl: record.logoUrl ?? null,
    faviconUrl: record.faviconUrl ?? null,
    primaryColor: record.primaryColor,
    accentColor: record.accentColor,
    surfaceColor: record.surfaceColor,
    textColor: record.textColor,
    supportEmail: record.supportEmail ?? null,
    marketingHeadline: record.marketingHeadline,
  };
}

function parseAppSettings(value: unknown): AppSettings {
  const record = parseRecord(value, 'Invalid app settings payload');
  if (
    (record.currency !== 'BRL' && record.currency !== 'USD')
    || (record.locale !== 'pt-BR' && record.locale !== 'en-US')
    || !isString(record.timezone)
    || !isNumber(record.billingDayDefault)
  ) {
    throw new Error('Invalid app settings payload');
  }

  return {
    currency: record.currency,
    locale: record.locale,
    timezone: record.timezone,
    billingDayDefault: record.billingDayDefault,
  };
}

function parseInviteInfo(value: unknown): InviteInfo {
  const record = parseRecord(value, 'Invalid invite payload');
  if (!isString(record.code) || !isString(record.createdAt) || !isNullableString(record.expiresAt)) {
    throw new Error('Invalid invite payload');
  }

  return {
    code: record.code,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt ?? null,
  };
}

function parseTransactionDraft(value: unknown): Omit<Transaction, 'id'> {
  const transaction = parseTransaction({ ...parseRecord(value, 'Invalid import payload'), id: 'import-preview' });
  const { id: _id, ...draft } = transaction;
  return draft;
}

export function parseMessageResponse(value: unknown) {
  const record = parseRecord(value, 'Invalid response payload');
  if (!isString(record.message)) {
    throw new Error('Invalid response payload');
  }
  return { message: record.message };
}

export function parseCurrentUserResponse(value: unknown) {
  const record = parseRecord(value, 'Invalid auth response');
  return { user: parseUser(record.user) };
}

export function parseAuthStatusResponse(value: unknown): AuthStatus {
  const record = parseRecord(value, 'Invalid auth status payload');
  if (!isBoolean(record.publicRegistrationOpen)) {
    throw new Error('Invalid auth status payload');
  }

  return {
    publicRegistrationOpen: record.publicRegistrationOpen,
  };
}

export function parseTransactionsResponse(value: unknown) {
  const record = parseRecord(value, 'Invalid transactions response');
  if (!Array.isArray(record.transactions)) {
    throw new Error('Invalid transactions response');
  }
  return { transactions: record.transactions.map(parseTransaction) };
}

export function parseTransactionResponse(value: unknown) {
  const record = parseRecord(value, 'Invalid transaction response');
  const transactions = Array.isArray(record.transactions) ? record.transactions.map(parseTransaction) : undefined;
  const transaction = record.transaction === undefined ? undefined : parseTransaction(record.transaction);

  if (!transaction && !transactions) {
    throw new Error('Invalid transaction response');
  }

  return { transaction, transactions };
}

export function parseCategoriesResponse(value: unknown) {
  const record = parseRecord(value, 'Invalid categories response');
  if (!Array.isArray(record.categories)) {
    throw new Error('Invalid categories response');
  }
  return { categories: record.categories.map(parseCustomCategory) };
}

export function parseCategoryResponse(value: unknown) {
  const record = parseRecord(value, 'Invalid category response');
  return { category: parseCustomCategory(record.category) };
}

export function parseBrandSettingsResponse(value: unknown) {
  const record = parseRecord(value, 'Invalid brand settings response');
  return { settings: parseBrandSettings(record.settings) };
}

export function parseAppSettingsResponse(value: unknown) {
  const record = parseRecord(value, 'Invalid app settings response');
  return { settings: parseAppSettings(record.settings) };
}

export function parseInviteResponse(value: unknown) {
  const record = parseRecord(value, 'Invalid invite response');
  return { invite: parseInviteInfo(record.invite) };
}

export function parseExportPayload(value: unknown): ExportPayload {
  const record = parseRecord(value, 'Invalid export payload');
  if (!isString(record.exportedAt) || !Array.isArray(record.transactions) || !Array.isArray(record.categories)) {
    throw new Error('Invalid export payload');
  }

  return {
    exportedAt: record.exportedAt,
    transactions: record.transactions.map(parseTransactionDraft),
    categories: record.categories.map(category => {
      const parsed = parseCustomCategory({ ...parseRecord(category, 'Invalid export payload'), id: 'category-preview' });
      return {
        key: parsed.key,
        name: parsed.name,
        color: parsed.color,
      };
    }),
  };
}

export function parseImportFilePayload(value: unknown): Pick<ExportPayload, 'transactions' | 'categories'> {
  const record = parseRecord(value, 'Invalid import payload');
  const transactions = record.transactions === undefined ? [] : parseExportPayload({
    exportedAt: typeof record.exportedAt === 'string' ? record.exportedAt : new Date(0).toISOString(),
    transactions: record.transactions,
    categories: record.categories ?? [],
  }).transactions;

  const categories = record.categories === undefined ? [] : parseExportPayload({
    exportedAt: typeof record.exportedAt === 'string' ? record.exportedAt : new Date(0).toISOString(),
    transactions: record.transactions ?? [],
    categories: record.categories,
  }).categories;

  return {
    transactions,
    categories,
  };
}
