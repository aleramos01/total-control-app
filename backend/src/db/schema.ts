import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
});

export const invites = sqliteTable('invites', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  createdByUserId: text('created_by_user_id').notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at'),
  usedAt: text('used_at'),
  usedByUserId: text('used_by_user_id'),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  type: text('type').notNull(),
  categoryKey: text('category_key').notNull(),
  transactionDate: text('transaction_date').notNull(),
  scheduleType: text('schedule_type').notNull().default('once'),
  seriesId: text('series_id'),
  installmentIndex: integer('installment_index'),
  installmentCount: integer('installment_count'),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).notNull().default(false),
  dueDate: text('due_date'),
  isPaid: integer('is_paid', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const customCategories = sqliteTable('custom_categories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  key: text('key').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  createdAt: text('created_at').notNull(),
});

export const brandSettings = sqliteTable('brand_settings', {
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

export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey(),
  currency: text('currency').notNull(),
  locale: text('locale').notNull(),
  timezone: text('timezone').notNull(),
  billingDayDefault: integer('billing_day_default').notNull(),
});
