import type { Locale } from './locales';

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export interface InviteInfo {
  code: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface CustomCategory {
  id: string;
  key: string;
  name: string;
  color: string;
}

export interface BrandSettings {
  productName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
  supportEmail: string | null;
  marketingHeadline: string;
}

export interface AppSettings {
  currency: 'BRL' | 'USD';
  locale: Locale;
  timezone: string;
  billingDayDefault: number;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: TransactionType;
  category: string;
  scheduleType?: 'once' | 'recurring' | 'installment';
  seriesId?: string | null;
  installmentIndex?: number | null;
  installmentCount?: number | null;
  isRecurring?: boolean;
  dueDate?: string;
  isPaid?: boolean;
  notes?: string | null;
}

export interface TransactionFilters {
  q?: string;
  type?: TransactionType | '';
  category?: string;
  status?: 'paid' | 'unpaid' | '';
  preset?: 'current_month' | 'previous_month' | 'next_30_days' | 'overdue' | '';
  from?: string;
  to?: string;
}

export interface ExportPayload {
  exportedAt: string;
  transactions: Array<Omit<Transaction, 'id'>>;
  categories: Array<Pick<CustomCategory, 'key' | 'name' | 'color'>>;
}
