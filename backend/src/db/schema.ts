import { boolean, doublePrecision, integer, pgTable, text, uniqueIndex, index } from 'drizzle-orm/pg-core';
import type { AppLocale, Currency, ScheduleType, TransactionType, UserRole, UserStatus } from '../lib/contracts.js';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<UserRole>().notNull().default('user'),
  status: text('status').$type<UserStatus>().notNull().default('active'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
});

export const invites = pgTable('invites', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  createdByUserId: text('created_by_user_id').notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at'),
  usedAt: text('used_at'),
  usedByUserId: text('used_by_user_id'),
}, table => ({
  codeIdx: uniqueIndex('idx_invites_code').on(table.code),
}));

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  description: text('description').notNull(),
  amount: doublePrecision('amount').notNull(),
  type: text('type').$type<TransactionType>().notNull(),
  categoryKey: text('category_key').notNull(),
  transactionDate: text('transaction_date').notNull(),
  scheduleType: text('schedule_type').$type<ScheduleType>().notNull().default('once'),
  seriesId: text('series_id'),
  installmentIndex: integer('installment_index'),
  installmentCount: integer('installment_count'),
  isRecurring: boolean('is_recurring').notNull().default(false),
  dueDate: text('due_date'),
  isPaid: boolean('is_paid').notNull().default(false),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => ({
  userDateIdx: index('idx_transactions_user_date').on(table.userId, table.transactionDate),
  dueDateIdx: index('idx_transactions_due_date').on(table.userId, table.dueDate),
  paidIdx: index('idx_transactions_paid').on(table.userId, table.isPaid),
}));

export const customCategories = pgTable('custom_categories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  key: text('key').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  createdAt: text('created_at').notNull(),
}, table => ({
  userKeyIdx: uniqueIndex('idx_custom_categories_user_key').on(table.userId, table.key),
}));

export const brandSettings = pgTable('brand_settings', {
  id: integer('id').primaryKey(),
  productName: text('product_name').notNull(),
  logoUrl: text('logo_url'),
  faviconUrl: text('favicon_url'),
  primaryColor: text('primary_color').notNull(),
  accentColor: text('accent_color').notNull(),
  surfaceColor: text('surface_color').notNull(),
  textColor: text('text_color').notNull(),
  supportEmail: text('support_email'),
  marketingHeadline: text('marketing_headline').notNull(),
});

export const appSettings = pgTable('app_settings', {
  id: integer('id').primaryKey(),
  currency: text('currency').$type<Currency>().notNull(),
  locale: text('locale').$type<AppLocale>().notNull(),
  timezone: text('timezone').notNull(),
  billingDayDefault: integer('billing_day_default').notNull(),
});
