import crypto from 'node:crypto';

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
