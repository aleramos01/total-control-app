import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { PRIMARY_ADMIN_EMAIL, PRIMARY_ADMIN_NAME } from '../lib/admin.js';
import { createId, nowIso } from '../lib/utils.js';
import { db, queryClient } from './client.js';
import { users } from './schema.js';

let didMigrate = false;

function resolveMigrationsFolder() {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), '../../drizzle');
}

async function ensureMigrationsTable() {
  await queryClient.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await queryClient.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      hash text PRIMARY KEY,
      created_at bigint NOT NULL
    )
  `);
}

async function applySqlMigrations() {
  await ensureMigrationsTable();

  const migrationsFolder = resolveMigrationsFolder();
  const migrationFiles = fs
    .readdirSync(migrationsFolder)
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const fileName of migrationFiles) {
    const filePath = path.join(migrationsFolder, fileName);
    const contents = fs.readFileSync(filePath, 'utf8');
    const hash = crypto.createHash('sha256').update(contents).digest('hex');
    const existing = await queryClient.query('SELECT hash FROM drizzle.__drizzle_migrations WHERE hash = $1', [hash]);

    if ((existing.rowCount ?? existing.rows?.length ?? 0) > 0) {
      continue;
    }

    const statements = contents
      .split('--> statement-breakpoint')
      .map(statement => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await queryClient.query(statement);
    }

    await queryClient.query(
      'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
      [hash, Date.now()]
    );
  }
}

export async function ensurePrimaryAdminRole() {
  await db
    .update(users)
    .set({ role: 'admin' })
    .where(eq(users.email, PRIMARY_ADMIN_EMAIL));
}

export async function ensurePrimaryAdminAccount() {
  const password = process.env.PRIMARY_ADMIN_PASSWORD;
  if (!password) {
    await ensurePrimaryAdminRole();
    return;
  }

  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.email, PRIMARY_ADMIN_EMAIL),
  });

  if (existingAdmin) {
    await db
      .update(users)
      .set({
        role: 'admin',
        status: 'active',
        updatedAt: nowIso(),
      })
      .where(eq(users.id, existingAdmin.id));
    return;
  }

  const timestamp = nowIso();
  await db.insert(users).values({
    id: createId('user'),
    name: process.env.PRIMARY_ADMIN_NAME?.trim() || PRIMARY_ADMIN_NAME,
    email: PRIMARY_ADMIN_EMAIL,
    passwordHash: await argon2.hash(password),
    role: 'admin',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function ensureDatabase() {
  if (!didMigrate) {
    await applySqlMigrations();
    didMigrate = true;
  }

  await ensurePrimaryAdminAccount();
}
