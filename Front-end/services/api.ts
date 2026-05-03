import type { FunctionsHttpError } from '@supabase/supabase-js';
import type { AppSettings, AuthStatus, BrandSettings, CustomCategory, ExportPayload, InviteInfo, Transaction, TransactionFilters, User } from '../types';
import { buildTransactionInsertRows, buildTransactionUpdateRow, buildCategoryInsertRow, buildPresetRange, defaultAppSettings, mapAppSettingsRow, mapBrandSettingsRow, mapCategoryRow, mapInviteRow, mapProfileRow, mapTransactionRow, type DbAppSettingsRow, type DbBrandSettingsRow, type DbCategoryRow, type DbInviteRow, type DbProfileRow, type DbTransactionRow } from './supabase-helpers';
import { resolveImportedTransactionCategory } from '../lib/categories';
import { parseAuthStatusResponse } from './parsers';
import { supabase } from './supabase';

type UserResponse = { user: User };
type MessageResponse = { message: string };

function isFunctionsHttpError(error: unknown): error is FunctionsHttpError {
  return typeof error === 'object' && error !== null && 'context' in error;
}

async function normalizeFunctionError(error: unknown) {
  if (isFunctionsHttpError(error)) {
    const payload = await error.context.json().catch(() => null);
    if (payload && typeof payload.message === 'string') {
      return payload.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Unexpected request failure';
}

function normalizeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function ensureResult<T>(data: T | null, error: { message?: string } | null, fallbackMessage: string) {
  if (error) {
    throw new Error(error.message || fallbackMessage);
  }

  if (data === null) {
    throw new Error(fallbackMessage);
  }

  return data;
}

async function getSessionUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Unauthorized');
  }

  return data.user;
}

async function getCurrentProfile(userId?: string) {
  const authUser = userId ? { id: userId } : await getSessionUser();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, status')
    .eq('id', authUser.id)
    .single();

  return mapProfileRow(ensureResult(data as DbProfileRow | null, error, 'User profile not found'));
}

async function invokeFunction<T>(name: string, body?: unknown) {
  const { data, error } = await supabase.functions.invoke(name, body === undefined ? undefined : { body });
  if (error) {
    throw new Error(await normalizeFunctionError(error));
  }

  return data as T;
}

export async function getCurrentUser(): Promise<User> {
  return getCurrentProfile();
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const data = await invokeFunction<AuthStatus>('auth-status');
  return parseAuthStatusResponse(data);
}

export async function loginUser(data: { email: string; password: string; rememberMe?: boolean }): Promise<UserResponse> {
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error || !authData.user) {
    throw new Error(error?.message || 'Invalid credentials');
  }

  return { user: await getCurrentProfile(authData.user.id) };
}

export async function registerUser(data: { name: string; email: string; password: string }): Promise<UserResponse> {
  await invokeFunction<UserResponse>('register-public', data);
  return loginUser({ email: data.email, password: data.password, rememberMe: true });
}

export async function registerWithInvite(data: { name: string; email: string; password: string; inviteCode: string }): Promise<UserResponse> {
  await invokeFunction<UserResponse>('register-with-invite', data);
  return loginUser({ email: data.email, password: data.password, rememberMe: true });
}

export async function logoutUser(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchTransactions(filters: TransactionFilters = {}): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false });

  if (filters.q) {
    query = query.ilike('description', `%${filters.q}%`);
  }
  if (filters.type) {
    query = query.eq('type', filters.type);
  }
  if (filters.category) {
    query = query.eq('category_key', filters.category);
  }
  if (filters.status === 'paid') {
    query = query.eq('is_paid', true);
  }
  if (filters.status === 'unpaid') {
    query = query.eq('is_paid', false);
  }

  const presetRange = filters.preset ? buildPresetRange(filters.preset) : null;
  const from = filters.from ?? presetRange?.from;
  const to = filters.to ?? presetRange?.to;

  if (filters.preset === 'next_30_days' || filters.preset === 'overdue') {
    query = query.eq('type', 'expense');
    if (from) {
      query = query.gte('due_date', from);
    }
    if (to) {
      query = query.lte('due_date', to);
    }
  } else {
    if (from) {
      query = query.gte('transaction_date', from);
    }
    if (to) {
      query = query.lte('transaction_date', to);
    }
  }

  if (filters.preset === 'overdue') {
    query = query.eq('is_paid', false);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || 'Failed to fetch transactions');
  }

  return (data as DbTransactionRow[] | null)?.map(mapTransactionRow) ?? [];
}

export async function saveTransaction(transaction: Omit<Transaction, 'id'> & { id?: string }): Promise<Transaction> {
  const rows = await saveTransactionBatch(transaction);
  const [saved] = rows;

  if (!saved) {
    throw new Error('Invalid transaction response');
  }

  return saved;
}

export async function saveTransactionBatch(transaction: Omit<Transaction, 'id'> & { id?: string }): Promise<Transaction[]> {
  const authUser = await getSessionUser();

  if (transaction.id) {
    const { data: existing, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transaction.id)
      .single();

    const existingRow = ensureResult(existing as DbTransactionRow | null, fetchError, 'Transaction not found');
    const updatePayload = buildTransactionUpdateRow(transaction, existingRow);
    const { data, error } = await supabase
      .from('transactions')
      .update(updatePayload)
      .eq('id', transaction.id)
      .select('*')
      .single();

    return [mapTransactionRow(ensureResult(data as DbTransactionRow | null, error, 'Failed to update transaction'))];
  }

  const rows = buildTransactionInsertRows(authUser.id, transaction);
  const { data, error } = await supabase
    .from('transactions')
    .insert(rows)
    .select('*');

  if (error) {
    throw new Error(error.message || 'Failed to save transaction');
  }

  return ((data as DbTransactionRow[] | null) ?? [])
    .map(mapTransactionRow)
    .sort((left, right) => {
      const leftIndex = left.installmentIndex ?? 0;
      const rightIndex = right.installmentIndex ?? 0;
      return leftIndex - rightIndex;
    });
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) {
    throw new Error(error.message || 'Failed to delete transaction');
  }
}

export async function toggleTransactionPaidStatus(id: string, isPaid: boolean): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      is_paid: isPaid,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  return mapTransactionRow(ensureResult(data as DbTransactionRow | null, error, 'Failed to update payment status'));
}

export async function fetchCustomCategories(): Promise<CustomCategory[]> {
  const { data, error } = await supabase
    .from('custom_categories')
    .select('id, key, name, color')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Failed to fetch categories');
  }

  return (data as DbCategoryRow[] | null)?.map(mapCategoryRow) ?? [];
}

export async function addCustomCategory(category: Omit<CustomCategory, 'id' | 'key'>): Promise<CustomCategory> {
  const authUser = await getSessionUser();
  const existingCategories = await fetchCustomCategories();
  const payload = buildCategoryInsertRow(authUser.id, category, existingCategories.map(item => item.key));

  const { data, error } = await supabase
    .from('custom_categories')
    .insert(payload)
    .select('id, key, name, color')
    .single();

  return mapCategoryRow(ensureResult(data as DbCategoryRow | null, error, 'Failed to create category'));
}

export async function deleteCustomCategory(id: string): Promise<void> {
  const { data: category, error: categoryError } = await supabase
    .from('custom_categories')
    .select('id, key, name, color')
    .eq('id', id)
    .single();

  const existingCategory = ensureResult(category as DbCategoryRow | null, categoryError, 'Category not found');
  const { count, error: usageError } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('category_key', existingCategory.key);

  if (usageError) {
    throw new Error(usageError.message || 'Failed to validate category usage');
  }

  if ((count ?? 0) > 0) {
    throw new Error('Category is in use and cannot be deleted.');
  }

  const { error } = await supabase.from('custom_categories').delete().eq('id', id);
  if (error) {
    throw new Error(error.message || 'Failed to delete category');
  }
}

export async function fetchBrandSettings(): Promise<BrandSettings> {
  const { data, error } = await supabase
    .from('brand_settings')
    .select('product_name, logo_url, favicon_url, primary_color, accent_color, surface_color, text_color, support_email, marketing_headline')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    throw new Error(normalizeErrorMessage(error, 'Failed to fetch brand settings'));
  }

  return mapBrandSettingsRow(data as DbBrandSettingsRow | null);
}

export async function updateBrandSettings(settings: BrandSettings): Promise<BrandSettings> {
  const payload = {
    id: 1,
    product_name: settings.productName,
    logo_url: settings.logoUrl || null,
    favicon_url: settings.faviconUrl || null,
    primary_color: settings.primaryColor,
    accent_color: settings.accentColor,
    surface_color: settings.surfaceColor,
    text_color: settings.textColor,
    support_email: settings.supportEmail || null,
    marketing_headline: settings.marketingHeadline,
  };

  const { data, error } = await supabase
    .from('brand_settings')
    .upsert(payload)
    .select('product_name, logo_url, favicon_url, primary_color, accent_color, surface_color, text_color, support_email, marketing_headline')
    .single();

  return mapBrandSettingsRow(ensureResult(data as DbBrandSettingsRow | null, error, 'Failed to save brand settings'));
}

export async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('currency, locale, timezone, billing_day_default')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    throw new Error(normalizeErrorMessage(error, 'Failed to fetch app settings'));
  }

  if (!data) {
    return defaultAppSettings;
  }

  return mapAppSettingsRow(data as DbAppSettingsRow);
}

export async function updateAppSettings(settings: AppSettings): Promise<AppSettings> {
  const payload = {
    id: 1,
    currency: settings.currency,
    locale: settings.locale,
    timezone: settings.timezone,
    billing_day_default: settings.billingDayDefault,
  };

  const { data, error } = await supabase
    .from('app_settings')
    .upsert(payload)
    .select('currency, locale, timezone, billing_day_default')
    .single();

  return mapAppSettingsRow(ensureResult(data as DbAppSettingsRow | null, error, 'Failed to save app settings'));
}

export async function exportData(): Promise<ExportPayload> {
  const [transactions, categories] = await Promise.all([
    fetchTransactions({}),
    fetchCustomCategories(),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    transactions: transactions.map(({ id: _id, ...transaction }) => transaction),
    categories: categories.map(({ key, name, color }) => ({ key, name, color })),
  };
}

export async function importData(payload: Pick<ExportPayload, 'transactions' | 'categories'>): Promise<MessageResponse> {
  return invokeFunction<MessageResponse>('import-data', payload);
}

export async function createInvite(expiresInDays?: number): Promise<InviteInfo> {
  const data = await invokeFunction<{ invite: DbInviteRow }>('create-invite', expiresInDays ? { expiresInDays } : {});
  return mapInviteRow(data.invite);
}

export { resolveImportedTransactionCategory };
