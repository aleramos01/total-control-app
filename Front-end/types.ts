import type { Locale } from './locales';

export const transactionScheduleTypes = ['once', 'recurring', 'installment'] as const;
export type TransactionScheduleType = (typeof transactionScheduleTypes)[number];

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

export interface AuthStatus {
  publicRegistrationOpen: boolean;
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
  scheduleType?: TransactionScheduleType;
  seriesId?: string | null;
  installmentIndex?: number | null;
  installmentCount?: number | null;
  isRecurring?: boolean;
  dueDate?: string | null;
  isPaid?: boolean;
  notes?: string | null;
  accountId?: string | null;
  /** When set, this transaction is a transfer: money leaves accountId and arrives here. */
  transferToAccountId?: string | null;
}

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash';

export interface Account {
  id: string;
  name: string;
  bank: string | null;
  accountType: AccountType;
  initialBalance: number;
  color: string;
  icon: string;
}

export type TransactionScope = 'single' | 'series';

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

export interface ImportPreviewPayload {
  fileName: string;
  transactions: ExportPayload['transactions'];
  categories: ExportPayload['categories'];
}

export interface BankStatementRow {
  id: string;
  lineNumber: number;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  signature: string;
  raw: Record<string, string>;
  fitId?: string;
}

export interface StatementImportError {
  lineNumber: number;
  message: string;
  raw?: string;
}

export interface StatementImportCandidate {
  transaction: Transaction;
  confidence: number;
}

export interface StatementImportMatch {
  row: BankStatementRow;
  transaction: Transaction;
  confidence: number;
}

export interface StatementImportNewTransaction {
  row: BankStatementRow;
  transaction: Omit<Transaction, 'id'>;
}

export interface StatementImportDuplicate {
  row: BankStatementRow;
  reason: string;
  transaction?: Transaction;
}

export interface StatementImportConflict {
  row: BankStatementRow;
  reason: string;
  candidates: StatementImportCandidate[];
}

export interface StatementImportPreview {
  fileName: string;
  totalRows: number;
  matches: StatementImportMatch[];
  newTransactions: StatementImportNewTransaction[];
  duplicates: StatementImportDuplicate[];
  conflicts: StatementImportConflict[];
  errors: StatementImportError[];
}

export type StatementImportAction =
  | {
      type: 'update';
      transactionId: string;
      amount: number;
      isPaid?: boolean;
    }
  | {
      type: 'create';
      transaction: Omit<Transaction, 'id'>;
    };

export interface StatementImportApplyResult {
  updated: Transaction[];
  created: Transaction[];
}
