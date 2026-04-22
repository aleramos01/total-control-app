import type { FastifyReply, FastifyRequest } from 'fastify';

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  errorMessage?: string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

function getClientKey(request: FastifyRequest, key: string) {
  return `${key}:${request.ip}`;
}

function consume(clientKey: string, windowMs: number) {
  const now = Date.now();
  const current = store.get(clientKey);

  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowMs };
    store.set(clientKey, next);
    return next;
  }

  current.count += 1;
  return current;
}

export function clearRateLimitStore() {
  store.clear();
}

export async function enforceRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  options: RateLimitOptions,
) {
  const clientKey = getClientKey(request, options.key);
  const entry = consume(clientKey, options.windowMs);
  const remaining = Math.max(options.limit - entry.count, 0);

  reply.header('X-RateLimit-Limit', String(options.limit));
  reply.header('X-RateLimit-Remaining', String(remaining));
  reply.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count <= options.limit) {
    return true;
  }

  reply.header('Retry-After', String(Math.max(Math.ceil((entry.resetAt - Date.now()) / 1000), 1)));
  reply.status(429).send({
    message: options.errorMessage ?? 'Too many requests',
  });
  return false;
}
