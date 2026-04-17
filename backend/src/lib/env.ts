const requiredKeys = ['SESSION_SECRET'] as const;

for (const key of requiredKeys) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? '4000'),
  sessionSecret: process.env.SESSION_SECRET as string,
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://127.0.0.1:3000',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://127.0.0.1:3000,http://localhost:3000')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean),
};

export const isProduction = env.nodeEnv === 'production';
export const sessionCookieSameSite = isProduction ? 'none' : 'lax';
export const sessionCookieSecure = isProduction;
