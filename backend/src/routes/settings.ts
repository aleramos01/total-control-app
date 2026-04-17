import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { appSettings, brandSettings } from '../db/schema.js';
import { getAuthenticatedAdmin } from '../lib/auth.js';
import { appSettingsSchema, brandSettingsSchema } from '../lib/validators.js';

const defaultBrandSettings = {
  id: 1,
  productName: 'Total Control',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#275df5',
  accentColor: '#5c7cfa',
  surfaceColor: '#f7f8fa',
  textColor: '#1f2937',
  supportEmail: 'support@example.com',
  marketingHeadline: 'Controle financeiro simples, seguro e pronto para venda.',
};

const defaultAppSettings = {
  id: 1,
  currency: 'BRL',
  locale: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  billingDayDefault: 5,
};

export async function ensureDefaultSettings() {
  const brand = await db.query.brandSettings.findFirst({ where: eq(brandSettings.id, 1) });
  if (!brand) {
    await db.insert(brandSettings).values(defaultBrandSettings);
  }

  const appConfig = await db.query.appSettings.findFirst({ where: eq(appSettings.id, 1) });
  if (!appConfig) {
    await db.insert(appSettings).values(defaultAppSettings);
  }
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/settings/brand', async (_request, reply) => {
    const settings = await db.query.brandSettings.findFirst({ where: eq(brandSettings.id, 1) });
    return reply.send({ settings: settings ?? defaultBrandSettings });
  });

  app.put('/settings/brand', async (request, reply) => {
    const user = await getAuthenticatedAdmin(request, reply);
    if (!user) {
      return;
    }

    const parsed = brandSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Invalid brand settings payload', issues: parsed.error.flatten() });
    }

    await db.update(brandSettings).set({
      productName: parsed.data.productName,
      logoUrl: parsed.data.logoUrl || null,
      faviconUrl: parsed.data.faviconUrl || null,
      primaryColor: parsed.data.primaryColor,
      accentColor: parsed.data.accentColor,
      surfaceColor: parsed.data.surfaceColor,
      textColor: parsed.data.textColor,
      supportEmail: parsed.data.supportEmail || null,
      marketingHeadline: parsed.data.marketingHeadline,
    }).where(eq(brandSettings.id, 1));

    const settings = await db.query.brandSettings.findFirst({ where: eq(brandSettings.id, 1) });
    return reply.send({ settings });
  });

  app.get('/settings/app', async (_request, reply) => {
    const settings = await db.query.appSettings.findFirst({ where: eq(appSettings.id, 1) });
    return reply.send({ settings: settings ?? defaultAppSettings });
  });

  app.put('/settings/app', async (request, reply) => {
    const user = await getAuthenticatedAdmin(request, reply);
    if (!user) {
      return;
    }

    const parsed = appSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Invalid app settings payload', issues: parsed.error.flatten() });
    }

    await db.update(appSettings).set(parsed.data).where(eq(appSettings.id, 1));
    const settings = await db.query.appSettings.findFirst({ where: eq(appSettings.id, 1) });
    return reply.send({ settings });
  });
}
