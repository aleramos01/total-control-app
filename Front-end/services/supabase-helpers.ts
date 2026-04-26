import { addMonthsToStoredDate } from '../lib/transactions';
import { buildUniqueCategoryKey } from '../lib/categories';
import { createId } from '../lib/ids';
import type { AppSettings, BrandSettings, CustomCategory, InviteInfo, Transaction, TransactionFilters, User } from '../types';

export type DbProfileRow = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active';
};

export type DbInviteRow = {
  code: string;
  created_at: string;
  expires_at: string | null;
};

export type DbCategoryRow = {
  id: string;
  key: string;
  name: string;
  color: string;
};

export type DbBrandSettingsRow = {
  product_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  accent_color: string;
  surface_color: string;
  text_color: string;
  support_email: string | null;
  marketing_headline: string;
};

export type DbAppSettingsRow = {
  currency: 'BRL' | 'USD';
  locale: 'pt-BR' | 'en-US';
  timezone: string;
  billing_day_default: number;
};

export type DbTransactionRow = {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category_key: string;
  transaction_date: string;
  schedule_type: 'once' | 'recurring' | 'installment';
  series_id: string | null;
  installment_index: number | null;
  installment_count: number | null;
  is_recurring: boolean;
  due_date: string | null;
  is_paid: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export const defaultBrandSettings: BrandSettings = {
  productName: 'Total Control',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#275df5',
  accentColor: '#5c7cfa',
  surfaceColor: '#f7f8fa',
  textColor: '#1f2937',
  supportEmail: 'support@example.com',
  marketingHeadline: 'Controle financeiro simples, seguro e pronto para venda.',
};

export const defaultAppSettings: AppSettings = {
  currency: 'BRL',
  locale: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  billingDayDefault: 5,
};

function toIsoString(value: string | null | undefined) {
  return value ? new Date(value).toISOString() : null;
}

export function mapProfileRow(row: DbProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

export function mapInviteRow(row: DbInviteRow): InviteInfo {
  return {
    code: row.code,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: toIsoString(row.expires_at),
  };
}

export function mapCategoryRow(row: DbCategoryRow): CustomCategory {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    color: row.color,
  };
}

export function mapTransactionRow(row: DbTransactionRow): Transaction {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    date: new Date(row.transaction_date).toISOString(),
    type: row.type,
    category: row.category_key,
    scheduleType: row.schedule_type,
    seriesId: row.series_id,
    installmentIndex: row.installment_index,
    installmentCount: row.installment_count,
    isRecurring: row.is_recurring,
    dueDate: toIsoString(row.due_date),
    isPaid: row.is_paid,
    notes: row.notes,
  };
}

export function mapBrandSettingsRow(row: DbBrandSettingsRow | null | undefined): BrandSettings {
  if (!row) {
    return defaultBrandSettings;
  }

  return {
    productName: row.product_name,
    logoUrl: row.logo_url,
    faviconUrl: row.favicon_url,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    surfaceColor: row.surface_color,
    textColor: row.text_color,
    supportEmail: row.support_email,
    marketingHeadline: row.marketing_headline,
  };
}

export function mapAppSettingsRow(row: DbAppSettingsRow | null | undefined): AppSettings {
  if (!row) {
    return defaultAppSettings;
  }

  return {
    currency: row.currency,
    locale: row.locale,
    timezone: row.timezone,
    billingDayDefault: row.billing_day_default,
  };
}

export function buildPresetRange(preset: NonNullable<TransactionFilters['preset']>) {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  switch (preset) {
    case 'current_month':
      return {
        from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(),
        to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString(),
      };
    case 'previous_month':
      return {
        from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString(),
        to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999)).toISOString(),
      };
    case 'next_30_days':
      return {
        from: startOfToday.toISOString(),
        to: new Date(startOfToday.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
    case 'overdue':
      return {
        from: undefined,
        to: startOfToday.toISOString(),
      };
  }
}

export function buildTransactionInsertRows(
  userId: string,
  transaction: Omit<Transaction, 'id'> & { id?: string },
  now = new Date().toISOString(),
) {
  const scheduleType = transaction.scheduleType ?? 'once';
  const installmentCount = scheduleType === 'installment' ? Math.max(transaction.installmentCount ?? 1, 1) : 1;
  const seriesId = installmentCount > 1 ? createId('series') : null;

  return Array.from({ length: installmentCount }, (_, index) => {
    const nextDate = installmentCount > 1 ? addMonthsToStoredDate(transaction.date, index) : transaction.date;
    const nextDueDate = transaction.dueDate
      ? installmentCount > 1 ? addMonthsToStoredDate(transaction.dueDate, index) : transaction.dueDate
      : null;

    return {
      id: createId('txn'),
      user_id: userId,
      description: installmentCount > 1 ? `${transaction.description} (${index + 1}/${installmentCount})` : transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      category_key: transaction.category,
      transaction_date: nextDate,
      schedule_type: scheduleType,
      series_id: seriesId,
      installment_index: installmentCount > 1 ? index + 1 : null,
      installment_count: installmentCount > 1 ? installmentCount : null,
      is_recurring: Boolean(transaction.isRecurring) || scheduleType === 'recurring',
      due_date: nextDueDate,
      is_paid: Boolean(transaction.isPaid),
      notes: transaction.notes ?? null,
      created_at: now,
      updated_at: now,
    };
  });
}

export function buildTransactionUpdateRow(
  transaction: Omit<Transaction, 'id'> & { id?: string },
  existing: DbTransactionRow,
  now = new Date().toISOString(),
) {
  return {
    description: transaction.description,
    amount: transaction.amount,
    type: transaction.type,
    category_key: transaction.category,
    transaction_date: transaction.date,
    schedule_type: transaction.scheduleType ?? 'once',
    series_id: existing.series_id,
    installment_index: existing.installment_index,
    installment_count: existing.installment_count,
    is_recurring: Boolean(transaction.isRecurring),
    due_date: transaction.dueDate ?? null,
    is_paid: Boolean(transaction.isPaid),
    notes: transaction.notes ?? null,
    updated_at: now,
  };
}

export function buildCategoryInsertRow(userId: string, category: Omit<CustomCategory, 'id' | 'key'>, existingKeys: Iterable<string>) {
  return {
    id: createId('cat'),
    user_id: userId,
    key: buildUniqueCategoryKey(category.name, existingKeys),
    name: category.name,
    color: category.color,
    created_at: new Date().toISOString(),
  };
}
