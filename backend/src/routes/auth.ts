import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { clearUserSession, createUserSession, getAuthenticatedUser, getSessionCookie } from '../lib/auth.js';
import { createId, nowIso } from '../lib/utils.js';
import { loginSchema, registerSchema } from '../lib/validators.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (request, reply) => {
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
    const passwordHash = await argon2.hash(parsed.data.password);
    const userId = createId('user');
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const role = (userCount?.count ?? 0) === 0 ? 'admin' : 'user';

    await db.insert(users).values({
      id: userId,
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash,
      role,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await createUserSession(reply, userId);

    return reply.status(201).send({
      user: {
        id: userId,
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        role,
      },
    });
  });

  app.post('/auth/login', async (request, reply) => {
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

    await createUserSession(reply, user.id);

    return reply.send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
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
