import { AppSettings, BrandSettings, CustomCategory, ExportPayload, InviteInfo, Transaction, TransactionFilters, User } from '../types';
import { buildTransactionQuery } from '../lib/transactions';
import {
  parseAppSettingsResponse,
  parseBrandSettingsResponse,
  parseCategoriesResponse,
  parseCategoryResponse,
  parseCurrentUserResponse,
  parseExportPayload,
  parseInviteResponse,
  parseMessageResponse,
  parseTransactionResponse,
  parseTransactionsResponse,
} from './parsers';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:4000';

async function request<T>(path: string, parse: (payload: unknown) => T, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    throw new Error('Unexpected empty response');
  }

  return parse(await response.json());
}

async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? `Request failed with status ${response.status}`);
  }
}

export async function getCurrentUser(): Promise<User> {
  const response = await request('/auth/me', parseCurrentUserResponse);
  return response.user;
}

export async function loginUser(data: { email: string; password: string; rememberMe?: boolean }) {
  return request('/auth/login', parseCurrentUserResponse, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function registerWithInvite(data: { name: string; email: string; password: string; inviteCode: string }) {
  return request('/auth/register-with-invite', parseCurrentUserResponse, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function logoutUser() {
  await requestVoid('/auth/logout', { method: 'POST' });
}

export async function fetchTransactions(filters: TransactionFilters = {}): Promise<Transaction[]> {
  const response = await request(`/transactions${buildTransactionQuery(filters)}`, parseTransactionsResponse);
  return response.transactions;
}

export async function saveTransaction(transaction: Omit<Transaction, 'id'> & { id?: string }): Promise<Transaction> {
  const payload = {
    description: transaction.description,
    amount: transaction.amount,
    date: transaction.date,
    type: transaction.type,
    category: transaction.category,
    scheduleType: transaction.scheduleType ?? 'once',
    installmentCount: transaction.installmentCount ?? 1,
    isRecurring: !!transaction.isRecurring,
    dueDate: transaction.dueDate ?? null,
    isPaid: transaction.isPaid ?? false,
    notes: transaction.notes ?? null,
  };

  const response = await request(
    transaction.id ? `/transactions/${transaction.id}` : '/transactions',
    parseTransactionResponse,
    {
      method: transaction.id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    }
  );

  const saved = response.transactions?.[0] ?? response.transaction;
  if (!saved) {
    throw new Error('Invalid transaction response');
  }
  return saved;
}

export async function saveTransactionBatch(transaction: Omit<Transaction, 'id'> & { id?: string }): Promise<Transaction[]> {
  const payload = {
    description: transaction.description,
    amount: transaction.amount,
    date: transaction.date,
    type: transaction.type,
    category: transaction.category,
    scheduleType: transaction.scheduleType ?? 'once',
    installmentCount: transaction.installmentCount ?? 1,
    isRecurring: !!transaction.isRecurring,
    dueDate: transaction.dueDate ?? null,
    isPaid: transaction.isPaid ?? false,
    notes: transaction.notes ?? null,
  };

  const response = await request(
    transaction.id ? `/transactions/${transaction.id}` : '/transactions',
    parseTransactionResponse,
    {
      method: transaction.id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    }
  );

  if (response.transactions) {
    return response.transactions;
  }
  if (response.transaction) {
    return [response.transaction];
  }
  throw new Error('Invalid transaction response');
}

export async function deleteTransaction(id: string) {
  await requestVoid(`/transactions/${id}`, { method: 'DELETE' });
}

export async function toggleTransactionPaidStatus(id: string, isPaid: boolean): Promise<Transaction> {
  const response = await request(`/transactions/${id}/payment-status`, parseTransactionResponse, {
    method: 'PATCH',
    body: JSON.stringify({ isPaid }),
  });
  if (!response.transaction) {
    throw new Error('Invalid transaction response');
  }
  return response.transaction;
}

export async function fetchCustomCategories(): Promise<CustomCategory[]> {
  const response = await request('/categories', parseCategoriesResponse);
  return response.categories;
}

export async function addCustomCategory(category: Omit<CustomCategory, 'id' | 'key'>): Promise<CustomCategory> {
  const response = await request('/categories', parseCategoryResponse, {
    method: 'POST',
    body: JSON.stringify(category),
  });
  return response.category;
}

export async function deleteCustomCategory(id: string) {
  await requestVoid(`/categories/${id}`, { method: 'DELETE' });
}

export async function fetchBrandSettings(): Promise<BrandSettings> {
  const response = await request('/settings/brand', parseBrandSettingsResponse);
  return response.settings;
}

export async function updateBrandSettings(settings: BrandSettings): Promise<BrandSettings> {
  const response = await request('/settings/brand', parseBrandSettingsResponse, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  return response.settings;
}

export async function fetchAppSettings(): Promise<AppSettings> {
  const response = await request('/settings/app', parseAppSettingsResponse);
  return response.settings;
}

export async function updateAppSettings(settings: AppSettings): Promise<AppSettings> {
  const response = await request('/settings/app', parseAppSettingsResponse, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  return response.settings;
}

export async function exportData(): Promise<ExportPayload> {
  return request('/export/json', parseExportPayload);
}

export async function importData(payload: Pick<ExportPayload, 'transactions' | 'categories'>) {
  return request('/import/json', parseMessageResponse, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createInvite(expiresInDays?: number): Promise<InviteInfo> {
  const response = await request('/auth/invites', parseInviteResponse, {
    method: 'POST',
    body: JSON.stringify(expiresInDays ? { expiresInDays } : {}),
  });
  return response.invite;
}
