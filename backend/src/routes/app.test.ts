import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.SESSION_SECRET ??= 'test-session-secret';
process.env.CORS_ORIGIN ??= 'http://127.0.0.1:3000';
process.env.APP_BASE_URL ??= 'http://127.0.0.1:3000';
process.env.NODE_ENV = 'test';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'total-control-backend-'));
process.env.DATABASE_URL = path.join(tempDir, 'test.sqlite');

const [{ buildApp }, { sqlite }, { ensureSchema }] = await Promise.all([
  import('../app.js'),
  import('../db/client.js'),
  import('../db/init.js'),
]);

after(async () => {
  sqlite.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

beforeEach(() => {
  ensureSchema();
  sqlite.exec(`
    DELETE FROM sessions;
    DELETE FROM transactions;
    DELETE FROM custom_categories;
    DELETE FROM users;
    DELETE FROM brand_settings;
    DELETE FROM app_settings;
  `);
});

function readSessionCookie(setCookieHeader: string | string[] | undefined) {
  const rawHeader = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  assert.ok(rawHeader, 'Expected a session cookie to be set');
  const [cookie] = rawHeader.split(';');
  return cookie;
}

async function registerAndAuthenticate(app: Awaited<ReturnType<typeof buildApp>>, payload: { name: string; email: string; password: string }) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload,
  });

  assert.equal(response.statusCode, 201);

  return {
    user: response.json().user as { id: string; email: string; role: 'admin' | 'user' },
    cookie: readSessionCookie(response.headers['set-cookie']),
  };
}

test('first registered user becomes admin and the next user becomes regular user', async () => {
  const app = await buildApp();

  try {
    const first = await registerAndAuthenticate(app, {
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'super-secret-password',
    });
    const second = await registerAndAuthenticate(app, {
      name: 'Regular User',
      email: 'user@example.com',
      password: 'super-secret-password',
    });

    assert.equal(first.user.role, 'admin');
    assert.equal(second.user.role, 'user');
  } finally {
    await app.close();
  }
});

test('non-admin users cannot update global settings', async () => {
  const app = await buildApp();

  try {
    await registerAndAuthenticate(app, {
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'super-secret-password',
    });
    const user = await registerAndAuthenticate(app, {
      name: 'Regular User',
      email: 'user@example.com',
      password: 'super-secret-password',
    });

    const brandResponse = await app.inject({
      method: 'PUT',
      url: '/settings/brand',
      headers: { cookie: user.cookie },
      payload: {
        productName: 'Blocked',
        logoUrl: null,
        faviconUrl: null,
        primaryColor: '#123456',
        accentColor: '#654321',
        surfaceColor: '#ffffff',
        textColor: '#111111',
        supportEmail: 'support@example.com',
        marketingHeadline: 'Blocked update',
      },
    });
    const appSettingsResponse = await app.inject({
      method: 'PUT',
      url: '/settings/app',
      headers: { cookie: user.cookie },
      payload: {
        currency: 'USD',
        locale: 'en-US',
        timezone: 'America/New_York',
        billingDayDefault: 10,
      },
    });

    assert.equal(brandResponse.statusCode, 403);
    assert.equal(appSettingsResponse.statusCode, 403);
  } finally {
    await app.close();
  }
});

test('export and import preserve custom category keys for transactions', async () => {
  const app = await buildApp();

  try {
    const source = await registerAndAuthenticate(app, {
      name: 'Source User',
      email: 'source@example.com',
      password: 'super-secret-password',
    });

    const categoryResponse = await app.inject({
      method: 'POST',
      url: '/categories',
      headers: { cookie: source.cookie },
      payload: {
        name: 'Assinaturas',
        color: '#123456',
      },
    });
    assert.equal(categoryResponse.statusCode, 201);
    const category = categoryResponse.json().category as { key: string };

    const transactionResponse = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { cookie: source.cookie },
      payload: {
        description: 'Plano Pro',
        amount: 99.9,
        date: '2026-01-10T00:00:00.000Z',
        type: 'expense',
        category: category.key,
        isRecurring: true,
        dueDate: '2026-01-15T00:00:00.000Z',
        isPaid: false,
        notes: 'Export me',
      },
    });
    assert.equal(transactionResponse.statusCode, 201);

    const exportResponse = await app.inject({
      method: 'GET',
      url: '/export/json',
      headers: { cookie: source.cookie },
    });
    assert.equal(exportResponse.statusCode, 200);
    const exportedPayload = exportResponse.json() as {
      categories: Array<{ key: string; name: string; color: string }>;
      transactions: Array<{ category: string }>;
    };

    assert.equal(exportedPayload.categories[0]?.key, category.key);
    assert.equal(exportedPayload.transactions[0]?.category, category.key);

    const target = await registerAndAuthenticate(app, {
      name: 'Target User',
      email: 'target@example.com',
      password: 'super-secret-password',
    });

    const importResponse = await app.inject({
      method: 'POST',
      url: '/import/json',
      headers: { cookie: target.cookie },
      payload: exportedPayload,
    });
    assert.equal(importResponse.statusCode, 201);

    const targetCategoriesResponse = await app.inject({
      method: 'GET',
      url: '/categories',
      headers: { cookie: target.cookie },
    });
    const targetTransactionsResponse = await app.inject({
      method: 'GET',
      url: '/transactions',
      headers: { cookie: target.cookie },
    });

    const targetCategory = targetCategoriesResponse.json().categories[0] as { key: string };
    const targetTransaction = targetTransactionsResponse.json().transactions[0] as { category: string };

    assert.equal(targetCategory.key, category.key);
    assert.equal(targetTransaction.category, category.key);
  } finally {
    await app.close();
  }
});
