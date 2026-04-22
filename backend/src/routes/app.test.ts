import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

process.env.SESSION_SECRET ??= 'test-session-secret';
process.env.CORS_ORIGIN ??= 'http://127.0.0.1:3000';
process.env.APP_BASE_URL ??= 'http://127.0.0.1:3000';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:5432/total_control_test';

const originalPrimaryAdminPassword = process.env.PRIMARY_ADMIN_PASSWORD;
const originalPrimaryAdminName = process.env.PRIMARY_ADMIN_NAME;

delete process.env.PRIMARY_ADMIN_PASSWORD;
delete process.env.PRIMARY_ADMIN_NAME;

const [{ buildApp }, { closeDb, db }, { ensureDatabase, ensurePrimaryAdminAccount, ensurePrimaryAdminRole }, { clearRateLimitStore }, { appSettings, brandSettings, customCategories, invites, sessions, transactions, users }] = await Promise.all([
  import('../app.js'),
  import('../db/client.js'),
  import('../db/init.js'),
  import('../lib/rate-limit.js'),
  import('../db/schema.js'),
]);

after(async () => {
  if (originalPrimaryAdminPassword) {
    process.env.PRIMARY_ADMIN_PASSWORD = originalPrimaryAdminPassword;
  } else {
    delete process.env.PRIMARY_ADMIN_PASSWORD;
  }

  if (originalPrimaryAdminName) {
    process.env.PRIMARY_ADMIN_NAME = originalPrimaryAdminName;
  } else {
    delete process.env.PRIMARY_ADMIN_NAME;
  }

  await closeDb();
});

beforeEach(async () => {
  delete process.env.PRIMARY_ADMIN_PASSWORD;
  delete process.env.PRIMARY_ADMIN_NAME;
  clearRateLimitStore();
  await ensureDatabase();
  await db.delete(invites);
  await db.delete(sessions);
  await db.delete(transactions);
  await db.delete(customCategories);
  await db.delete(users);
  await db.delete(brandSettings);
  await db.delete(appSettings);
});

test('login is rate limited after repeated failures', async () => {
  const app = await buildApp();

  try {
    await registerAndAuthenticate(app, {
      name: 'Rate Limited User',
      email: 'ratelimit@example.com',
      password: 'super-secret-password',
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'ratelimit@example.com',
          password: 'wrong-password-value',
        },
      });

      assert.equal(response.statusCode, 401);
    }

    const blockedResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'ratelimit@example.com',
        password: 'wrong-password-value',
      },
    });

    assert.equal(blockedResponse.statusCode, 429);
    assert.equal(blockedResponse.json().message, 'Too many login attempts');
  } finally {
    await app.close();
  }
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

async function createInvite(app: Awaited<ReturnType<typeof buildApp>>, cookie: string, payload?: { expiresInDays?: number }) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/invites',
    headers: { cookie },
    payload: payload ?? {},
  });

  assert.equal(response.statusCode, 201);
  return response.json().invite as { code: string; expiresAt: string | null };
}

test('first registered user becomes admin and invited users become regular users', async () => {
  const app = await buildApp();

  try {
    const first = await registerAndAuthenticate(app, {
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'super-secret-password',
    });
    const invite = await createInvite(app, first.cookie);
    const second = await app.inject({
      method: 'POST',
      url: '/auth/register-with-invite',
      payload: {
        name: 'Regular User',
        email: 'user@example.com',
        password: 'super-secret-password',
        inviteCode: invite.code,
      },
    });

    assert.equal(first.user.role, 'admin');
    assert.equal(second.statusCode, 201);
    assert.equal(second.json().user.role, 'user');
  } finally {
    await app.close();
  }
});

test('session cookie is httpOnly and uses lax sameSite outside production', async () => {
  const app = await buildApp();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'Cookie User',
        email: 'cookie@example.com',
        password: 'super-secret-password',
      },
    });

    assert.equal(response.statusCode, 201);
    const setCookieHeader = response.headers['set-cookie'];
    const rawCookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;

    assert.ok(rawCookie);
    assert.match(rawCookie, /HttpOnly/i);
    assert.match(rawCookie, /SameSite=Lax/i);
    assert.doesNotMatch(rawCookie, /Secure/i);
  } finally {
    await app.close();
  }
});

test('login omits persistent cookie max-age when rememberMe is false', async () => {
  const app = await buildApp();

  try {
    await registerAndAuthenticate(app, {
      name: 'Login User',
      email: 'login@example.com',
      password: 'super-secret-password',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'login@example.com',
        password: 'super-secret-password',
        rememberMe: false,
      },
    });

    assert.equal(response.statusCode, 200);
    const setCookieHeader = response.headers['set-cookie'];
    const rawCookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;

    assert.ok(rawCookie);
    assert.doesNotMatch(rawCookie, /Max-Age=/i);
  } finally {
    await app.close();
  }
});

test('logout invalidates the persisted session', async () => {
  const app = await buildApp();

  try {
    const user = await registerAndAuthenticate(app, {
      name: 'Logout User',
      email: 'logout@example.com',
      password: 'super-secret-password',
    });

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { cookie: user.cookie },
    });
    assert.equal(logoutResponse.statusCode, 204);

    const meResponse = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie: user.cookie },
    });
    assert.equal(meResponse.statusCode, 401);
  } finally {
    await app.close();
  }
});

test('protected routes reject unauthenticated requests', async () => {
  const app = await buildApp();

  try {
    const transactionsResponse = await app.inject({ method: 'GET', url: '/transactions' });
    const categoriesResponse = await app.inject({ method: 'GET', url: '/categories' });
    const exportResponse = await app.inject({ method: 'GET', url: '/export/json' });
    const updateSettingsResponse = await app.inject({
      method: 'PUT',
      url: '/settings/app',
      payload: {
        currency: 'USD',
        locale: 'en-US',
        timezone: 'America/New_York',
        billingDayDefault: 10,
      },
    });

    assert.equal(transactionsResponse.statusCode, 401);
    assert.equal(categoriesResponse.statusCode, 401);
    assert.equal(exportResponse.statusCode, 401);
    assert.equal(updateSettingsResponse.statusCode, 401);
  } finally {
    await app.close();
  }
});

test('non-admin users cannot update global settings', async () => {
  const app = await buildApp();

  try {
    const admin = await registerAndAuthenticate(app, {
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'super-secret-password',
    });
    const invite = await createInvite(app, admin.cookie);
    const userResponse = await app.inject({
      method: 'POST',
      url: '/auth/register-with-invite',
      payload: {
        name: 'Regular User',
        email: 'user@example.com',
        password: 'super-secret-password',
        inviteCode: invite.code,
      },
    });
    assert.equal(userResponse.statusCode, 201);
    const user = {
      cookie: readSessionCookie(userResponse.headers['set-cookie']),
    };

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

test('invite code creates a regular user exactly once and expired invite is rejected', async () => {
  const app = await buildApp();

  try {
    const admin = await registerAndAuthenticate(app, {
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'super-secret-password',
    });
    const invite = await createInvite(app, admin.cookie, { expiresInDays: 7 });

    const firstUse = await app.inject({
      method: 'POST',
      url: '/auth/register-with-invite',
      payload: {
        name: 'Invited User',
        email: 'invited@example.com',
        password: 'super-secret-password',
        inviteCode: invite.code,
      },
    });

    assert.equal(firstUse.statusCode, 201);
    assert.equal(firstUse.json().user.role, 'user');

    const secondUse = await app.inject({
      method: 'POST',
      url: '/auth/register-with-invite',
      payload: {
        name: 'Invited Again',
        email: 'invited-again@example.com',
        password: 'super-secret-password',
        inviteCode: invite.code,
      },
    });

    assert.equal(secondUse.statusCode, 400);

    const expiredInvite = await createInvite(app, admin.cookie);
    await db
      .update(invites)
      .set({ expiresAt: '2020-01-01T00:00:00.000Z' })
      .where(eq(invites.code, expiredInvite.code));

    const expiredResponse = await app.inject({
      method: 'POST',
      url: '/auth/register-with-invite',
      payload: {
        name: 'Late User',
        email: 'late@example.com',
        password: 'super-secret-password',
        inviteCode: expiredInvite.code,
      },
    });

    assert.equal(expiredResponse.statusCode, 400);
  } finally {
    await app.close();
  }
});

test('ensureDatabase promotes an existing primary admin account to admin', async () => {
  await db.insert(users).values({
    id: 'user_existing',
    name: 'Xandy',
    email: 'xandyramoscrazy@gmail.com',
    passwordHash: 'hash-placeholder',
    role: 'user',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  await ensurePrimaryAdminRole();

  const user = await db.query.users.findFirst({
    where: eq(users.email, 'xandyramoscrazy@gmail.com'),
    columns: { role: true },
  });

  assert.equal(user?.role, 'admin');
});

test('ensurePrimaryAdminAccount creates the primary admin when PRIMARY_ADMIN_PASSWORD is configured', async () => {
  process.env.PRIMARY_ADMIN_PASSWORD = 'ale220506';
  process.env.PRIMARY_ADMIN_NAME = 'Xandy Ramos';

  try {
    await ensurePrimaryAdminAccount();

    const user = await db.query.users.findFirst({
      where: eq(users.email, 'xandyramoscrazy@gmail.com'),
      columns: { name: true, role: true, status: true },
    });

    assert.equal(user?.name, 'Xandy Ramos');
    assert.equal(user?.role, 'admin');
    assert.equal(user?.status, 'active');
  } finally {
    delete process.env.PRIMARY_ADMIN_PASSWORD;
    delete process.env.PRIMARY_ADMIN_NAME;
  }
});

test('export and import preserve custom category keys and isolate data per user', async () => {
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

    const invite = await createInvite(app, source.cookie);
    const targetResponse = await app.inject({
      method: 'POST',
      url: '/auth/register-with-invite',
      payload: {
        name: 'Target User',
        email: 'target@example.com',
        password: 'super-secret-password',
        inviteCode: invite.code,
      },
    });
    assert.equal(targetResponse.statusCode, 201);
    const target = {
      cookie: readSessionCookie(targetResponse.headers['set-cookie']),
    };

    const importResponse = await app.inject({
      method: 'POST',
      url: '/import/json',
      headers: { cookie: target.cookie },
      payload: exportedPayload,
    });
    assert.equal(importResponse.statusCode, 201);

    const targetTransactionsResponse = await app.inject({
      method: 'GET',
      url: '/transactions',
      headers: { cookie: target.cookie },
    });
    const sourceTransactionsResponse = await app.inject({
      method: 'GET',
      url: '/transactions',
      headers: { cookie: source.cookie },
    });

    assert.equal(targetTransactionsResponse.json().transactions.length, 1);
    assert.equal(sourceTransactionsResponse.json().transactions.length, 1);
    assert.notEqual(targetTransactionsResponse.json().transactions[0].id, sourceTransactionsResponse.json().transactions[0].id);
  } finally {
    await app.close();
  }
});

test('creating an installment expense generates the full series', async () => {
  const app = await buildApp();

  try {
    const user = await registerAndAuthenticate(app, {
      name: 'Source User',
      email: 'source@example.com',
      password: 'super-secret-password',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { cookie: user.cookie },
      payload: {
        description: 'Notebook',
        amount: 500,
        date: '2026-01-10T00:00:00.000Z',
        type: 'expense',
        category: 'other',
        scheduleType: 'installment',
        installmentCount: 3,
        dueDate: '2026-01-15T00:00:00.000Z',
        isPaid: false,
      },
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().transactions.length, 3);
    assert.equal(response.json().transactions[0].installmentIndex, 1);
    assert.equal(response.json().transactions[2].installmentIndex, 3);
  } finally {
    await app.close();
  }
});

test('transaction preset filters support current month and overdue views', async () => {
  const app = await buildApp();

  try {
    const user = await registerAndAuthenticate(app, {
      name: 'Source User',
      email: 'source@example.com',
      password: 'super-secret-password',
    });

    await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { cookie: user.cookie },
      payload: {
        description: 'Conta vencida',
        amount: 120,
        date: '2025-01-10T00:00:00.000Z',
        type: 'expense',
        category: 'housing',
        dueDate: '2025-01-15T00:00:00.000Z',
        isPaid: false,
      },
    });

    await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { cookie: user.cookie },
      payload: {
        description: 'Salario atual',
        amount: 3000,
        date: new Date().toISOString(),
        type: 'income',
        category: 'salary',
        isPaid: true,
      },
    });

    const overdue = await app.inject({
      method: 'GET',
      url: '/transactions?preset=overdue',
      headers: { cookie: user.cookie },
    });
    const currentMonth = await app.inject({
      method: 'GET',
      url: '/transactions?preset=current_month',
      headers: { cookie: user.cookie },
    });

    assert.equal(overdue.statusCode, 200);
    assert.equal(overdue.json().transactions.length, 1);
    assert.equal(overdue.json().transactions[0].description, 'Conta vencida');
    assert.equal(currentMonth.statusCode, 200);
    assert.equal(currentMonth.json().transactions.length, 1);
  } finally {
    await app.close();
  }
});

test('search filters treat sql injection strings as plain text', async () => {
  const app = await buildApp();

  try {
    const user = await registerAndAuthenticate(app, {
      name: 'Search User',
      email: 'search@example.com',
      password: 'super-secret-password',
    });

    await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { cookie: user.cookie },
      payload: {
        description: 'Mercado local',
        amount: 80,
        date: '2026-01-10T00:00:00.000Z',
        type: 'expense',
        category: 'food',
        isPaid: false,
      },
    });

    const injectionResponse = await app.inject({
      method: 'GET',
      url: `/transactions?q=${encodeURIComponent(`' OR 1=1 --`)}`,
      headers: { cookie: user.cookie },
    });

    assert.equal(injectionResponse.statusCode, 200);
    assert.equal(injectionResponse.json().transactions.length, 0);

    const tableStillExists = await app.inject({
      method: 'GET',
      url: '/transactions',
      headers: { cookie: user.cookie },
    });
    assert.equal(tableStillExists.statusCode, 200);
    assert.equal(tableStillExists.json().transactions.length, 1);
  } finally {
    await app.close();
  }
});
