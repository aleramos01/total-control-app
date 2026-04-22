import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { ensureDatabase } from './db/init.js';
import { env } from './lib/env.js';
import { authRoutes } from './routes/auth.js';
import { categoryRoutes } from './routes/categories.js';
import { importExportRoutes } from './routes/import-export.js';
import { ensureDefaultSettings, settingsRoutes } from './routes/settings.js';
import { transactionRoutes } from './routes/transactions.js';

export async function buildApp() {
  await ensureDatabase();
  await ensureDefaultSettings();

  const app = Fastify({
    logger: {
      level: 'info',
      redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
    },
    bodyLimit: 1024 * 1024,
  });

  await app.register(cookie, { secret: env.sessionSecret });
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed'), false);
    },
    credentials: true,
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  app.get('/health', async () => ({ status: 'ok' }));

  await authRoutes(app);
  await transactionRoutes(app);
  await categoryRoutes(app);
  await settingsRoutes(app);
  await importExportRoutes(app);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    if (reply.sent) {
      return;
    }
    reply.status(500).send({
      message: env.nodeEnv === 'production' ? 'Internal server error' : error instanceof Error ? error.message : 'Internal server error',
    });
  });

  return app;
}
