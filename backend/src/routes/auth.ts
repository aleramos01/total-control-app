import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { invites, users } from '../db/schema.js';
import { isPrimaryAdminEmail } from '../lib/admin.js';
import { clearUserSession, createUserSession, getAuthenticatedUser, getSessionCookie } from '../lib/auth.js';
import { enforceRateLimit } from '../lib/rate-limit.js';
import { createId, createInviteCode, nowIso } from '../lib/utils.js';
import { createInviteSchema, inviteRegisterSchema, loginSchema, registerSchema } from '../lib/validators.js';

const loginRateLimit = { key: 'auth-login', limit: 5, windowMs: 10 * 60 * 1000, errorMessage: 'Too many login attempts' };
const registerRateLimit = { key: 'auth-register', limit: 3, windowMs: 10 * 60 * 1000, errorMessage: 'Too many registration attempts' };
const inviteRegistrationRateLimit = { key: 'auth-register-with-invite', limit: 5, windowMs: 10 * 60 * 1000, errorMessage: 'Too many invite registration attempts' };
const createInviteRateLimit = { key: 'auth-create-invite', limit: 10, windowMs: 60 * 60 * 1000, errorMessage: 'Too many invite creation attempts' };

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: unknown }>('/auth/register', async (request, reply) => {
    if (!(await enforceRateLimit(request, reply, registerRateLimit))) {
      return;
    }

    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Invalid registration payload', issues: parsed.error.flatten() });
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, parsed.data.email.toLowerCase()),
    });

    if (existingUser) {
      return reply.status(409).send({ message: 'Email already in use' });
    }

    const timestamp = nowIso();
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const totalUsers = Number(userCount?.count ?? 0);
    if (totalUsers > 0) {
      return reply.status(403).send({ message: 'Public registration is disabled. Use an invite code.' });
    }

    const passwordHash = await argon2.hash(parsed.data.password);
    const userId = createId('user');
    const normalizedEmail = parsed.data.email.toLowerCase();
    const role = totalUsers === 0 || isPrimaryAdminEmail(normalizedEmail) ? 'admin' : 'user';

    await db.insert(users).values({
      id: userId,
      name: parsed.data.name,
      email: normalizedEmail,
      passwordHash,
      role,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await createUserSession(reply, userId, true);

    return reply.status(201).send({
      user: {
        id: userId,
        name: parsed.data.name,
        email: normalizedEmail,
        role,
      },
    });
  });

  app.post<{ Body: unknown }>('/auth/login', async (request, reply) => {
    if (!(await enforceRateLimit(request, reply, loginRateLimit))) {
      return;
    }

    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Invalid login payload', issues: parsed.error.flatten() });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, parsed.data.email.toLowerCase()),
    });

    if (!user || !(await argon2.verify(user.passwordHash, parsed.data.password))) {
      return reply.status(401).send({ message: 'Invalid credentials' });
    }

    if (isPrimaryAdminEmail(user.email) && user.role !== 'admin') {
      await db
        .update(users)
        .set({
          role: 'admin',
          updatedAt: nowIso(),
        })
        .where(eq(users.id, user.id));

      user.role = 'admin';
    }

    await createUserSession(reply, user.id, parsed.data.rememberMe);

    return reply.send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  });

  app.post<{ Body: unknown }>('/auth/register-with-invite', async (request, reply) => {
    if (!(await enforceRateLimit(request, reply, inviteRegistrationRateLimit))) {
      return;
    }

    const parsed = inviteRegisterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Invalid registration payload', issues: parsed.error.flatten() });
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, parsed.data.email.toLowerCase()),
    });

    if (existingUser) {
      return reply.status(409).send({ message: 'Email already in use' });
    }

    const invite = await db.query.invites.findFirst({
      where: and(eq(invites.code, parsed.data.inviteCode.trim().toUpperCase()), isNull(invites.usedAt)),
    });

    if (!invite) {
      return reply.status(400).send({ message: 'Invalid or unavailable invite code' });
    }

    if (invite.expiresAt && invite.expiresAt <= nowIso()) {
      return reply.status(400).send({ message: 'Invite code expired' });
    }

    const timestamp = nowIso();
    const passwordHash = await argon2.hash(parsed.data.password);
    const userId = createId('user');
    const normalizedEmail = parsed.data.email.toLowerCase();
    const role = isPrimaryAdminEmail(normalizedEmail) ? 'admin' : 'user';

    await db.insert(users).values({
      id: userId,
      name: parsed.data.name,
      email: normalizedEmail,
      passwordHash,
      role,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await db
      .update(invites)
      .set({
        usedAt: timestamp,
        usedByUserId: userId,
      })
      .where(eq(invites.id, invite.id));

    await createUserSession(reply, userId, true);

    return reply.status(201).send({
      user: {
        id: userId,
        name: parsed.data.name,
        email: normalizedEmail,
        role,
      },
    });
  });

  app.post<{ Body: unknown }>('/auth/invites', async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    if (user.role !== 'admin') {
      return reply.status(403).send({ message: 'Admin access required' });
    }

    if (!(await enforceRateLimit(request, reply, createInviteRateLimit))) {
      return;
    }

    const parsed = createInviteSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Invalid invite payload', issues: parsed.error.flatten() });
    }

    const createdAt = nowIso();
    const invite = {
      id: createId('invite'),
      code: createInviteCode(),
      createdByUserId: user.id,
      createdAt,
      expiresAt: parsed.data.expiresInDays ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null,
      usedAt: null,
      usedByUserId: null,
    };

    await db.insert(invites).values(invite);

    return reply.status(201).send({
      invite: {
        code: invite.code,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
      },
    });
  });

  app.post('/auth/logout', async (request, reply) => {
    await clearUserSession(reply, getSessionCookie(request));
    return reply.status(204).send();
  });

  app.get('/auth/me', async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    return reply.send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  });
}
