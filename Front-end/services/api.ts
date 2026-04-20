import { AppSettings, BrandSettings, CustomCategory, ExportPayload, InviteInfo, Transaction, TransactionFilters, User } from '../types';
import { buildTransactionQuery } from '../lib/transactions';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getCurrentUser(): Promise<User> {
  const response = await request<{ user: User }>('/auth/me');
  return response.user;
}

export async function loginUser(data: { email: string; password: string; rememberMe?: boolean }) {
  return request<{ user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function registerWithInvite(data: { name: string; email: string; password: string; inviteCode: string }) {
  return request<{ user: User }>('/auth/register-with-invite', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function logoutUser() {
  await request<void>('/auth/logout', { method: 'POST' });
}

export async function fetchTransactions(filters: TransactionFilters = {}): Promise<Transaction[]> {
  const response = await request<{ transactions: Transaction[] }>(`/transactions${buildTransactionQuery(filters)}`);
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

  const response = await request<{ transaction: Transaction; transactions?: Transaction[] }>(
    transaction.id ? `/transactions/${transaction.id}` : '/transactions',
    {
      method: transaction.id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    }
  );

  return response.transactions?.[0] ?? response.transaction;
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

  const response = await request<{ transaction: Transaction; transactions?: Transaction[] }>(
    transaction.id ? `/transactions/${transaction.id}` : '/transactions',
    {
      method: transaction.id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    }
  );

  return response.transactions ?? [response.transaction];
}

export async function deleteTransaction(id: string) {
  await request<void>(`/transactions/${id}`, { method: 'DELETE' });
}

export async function toggleTransactionPaidStatus(id: string, isPaid: boolean): Promise<Transaction> {
  const response = await request<{ transaction: Transaction }>(`/transactions/${id}/payment-status`, {
    method: 'PATCH',
    body: JSON.stringify({ isPaid }),
  });
  return response.transaction;
}

export async function fetchCustomCategories(): Promise<CustomCategory[]> {
  const response = await request<{ categories: CustomCategory[] }>('/categories');
  return response.categories;
}

export async function addCustomCategory(category: Omit<CustomCategory, 'id' | 'key'>): Promise<CustomCategory> {
  const response = await request<{ category: CustomCategory }>('/categories', {
    method: 'POST',
    body: JSON.stringify(category),
  });
  return response.category;
}

export async function deleteCustomCategory(id: string) {
  await request<void>(`/categories/${id}`, { method: 'DELETE' });
}

export async function fetchBrandSettings(): Promise<BrandSettings> {
  const response = await request<{ settings: BrandSettings }>('/settings/brand');
  return response.settings;
}

export async function updateBrandSettings(settings: BrandSettings): Promise<BrandSettings> {
  const response = await request<{ settings: BrandSettings }>('/settings/brand', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  return response.settings;
}

export async function fetchAppSettings(): Promise<AppSettings> {
  const response = await request<{ settings: AppSettings }>('/settings/app');
  return response.settings;
}

export async function exportData(): Promise<ExportPayload> {
  return request<ExportPayload>('/export/json');
}

export async function importData(payload: Pick<ExportPayload, 'transactions' | 'categories'>) {
  return request<{ message: string }>('/import/json', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createInvite(expiresInDays?: number): Promise<InviteInfo> {
  const response = await request<{ invite: InviteInfo }>('/auth/invites', {
    method: 'POST',
    body: JSON.stringify(expiresInDays ? { expiresInDays } : {}),
  });
  return response.invite;
}
