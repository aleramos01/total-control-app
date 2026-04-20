import { sqlite } from './client.js';
import { PRIMARY_ADMIN_EMAIL } from '../lib/admin.js';

function hasColumn(table: string, column: string) {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some(row => row.name === column);
}

function ensureColumn(table: string, column: string, definition: string) {
  if (!hasColumn(table, column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

export function ensureSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      created_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      used_at TEXT,
      used_by_user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      category_key TEXT NOT NULL,
      transaction_date TEXT NOT NULL,
      schedule_type TEXT NOT NULL DEFAULT 'once',
      series_id TEXT,
      installment_index INTEGER,
      installment_count INTEGER,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      is_paid INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custom_categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS brand_settings (
      id INTEGER PRIMARY KEY,
      product_name TEXT NOT NULL,
      logo_url TEXT,
      favicon_url TEXT,
      primary_color TEXT NOT NULL,
      accent_color TEXT NOT NULL,
      surface_color TEXT NOT NULL,
      text_color TEXT NOT NULL,
      support_email TEXT,
      marketing_headline TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY,
      currency TEXT NOT NULL,
      locale TEXT NOT NULL,
      timezone TEXT NOT NULL,
      billing_day_default INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, transaction_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_due_date ON transactions (user_id, due_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_paid ON transactions (user_id, is_paid);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_categories_user_key ON custom_categories (user_id, key);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_code ON invites (code);
  `);

  if (!hasColumn('users', 'role')) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';`);
  }

  ensureColumn('transactions', 'schedule_type', `TEXT NOT NULL DEFAULT 'once'`);
  ensureColumn('transactions', 'series_id', 'TEXT');
  ensureColumn('transactions', 'installment_index', 'INTEGER');
  ensureColumn('transactions', 'installment_count', 'INTEGER');

  sqlite
    .prepare(`UPDATE users SET role = 'admin' WHERE lower(email) = lower(?)`)
    .run(PRIMARY_ADMIN_EMAIL);
}
