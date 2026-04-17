import type { FastifyReply, FastifyRequest } from 'fastify';
import { and, eq, gt, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { sessions, users } from '../db/schema.js';
import { addDays, createId, createSessionToken, nowIso, sha256 } from './utils.js';
import { sessionCookieSameSite, sessionCookieSecure } from './env.js';

const SESSION_COOKIE = 'tc_session';

export async function purgeExpiredSessions() {
  await db.delete(sessions).where(lte(sessions.expiresAt, nowIso()));
}

export async function createUserSession(reply: FastifyReply, userId: string) {
  await purgeExpiredSessions();

  const token = createSessionToken();
  const tokenHash = sha256(token);

  await db.insert(sessions).values({
    id: createId('session'),
    userId,
    tokenHash,
    createdAt: nowIso(),
    expiresAt: addDays(14),
  });

  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: sessionCookieSameSite,
    path: '/',
    secure: sessionCookieSecure,
    maxAge: 14 * 24 * 60 * 60,
  });
}

export async function clearUserSession(reply: FastifyReply, token?: string) {
  if (token) {
    const tokenHash = sha256(token);
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  reply.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: sessionCookieSameSite,
    path: '/',
    secure: sessionCookieSecure,
  });
}

export async function getAuthenticatedUser(request: FastifyRequest) {
  await purgeExpiredSessions();

  const token = request.cookies[SESSION_COOKIE];
  if (!token) {
    return null;
  }

  const tokenHash = sha256(token);
  const now = nowIso();

  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)),
  });

  if (!session) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
  });

  return user ?? null;
}

export async function getAuthenticatedAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    reply.status(401).send({ message: 'Unauthorized' });
    return null;
  }

  if (user.role !== 'admin') {
    reply.status(403).send({ message: 'Admin access required' });
    return null;
  }

  return user;
}

export function getSessionCookie(request: FastifyRequest) {
  return request.cookies[SESSION_COOKIE];
}
