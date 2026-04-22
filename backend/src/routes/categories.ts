import type { FastifyInstance } from 'fastify';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { customCategories, transactions } from '../db/schema.js';
import { getAuthenticatedUser } from '../lib/auth.js';
import { buildUniqueCategoryKey, normalizeCategoryKey } from '../lib/categories.js';
import { createId, nowIso } from '../lib/utils.js';
import { categorySchema } from '../lib/validators.js';

export async function categoryRoutes(app: FastifyInstance) {
  app.get('/categories', async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    const rows = await db.query.customCategories.findMany({
      where: eq(customCategories.userId, user.id),
      orderBy: [asc(customCategories.name)],
    });

    return reply.send({
      categories: rows.map(row => ({
        id: row.id,
        key: row.key,
        name: row.name,
        color: row.color,
      })),
    });
  });

  app.post<{ Body: unknown }>('/categories', async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    const parsed = categorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Invalid category payload', issues: parsed.error.flatten() });
    }

    const existingKeys = await db.query.customCategories.findMany({
      where: eq(customCategories.userId, user.id),
      columns: { key: true },
    });
    const key = buildUniqueCategoryKey(
      parsed.data.key ? normalizeCategoryKey(parsed.data.key) : normalizeCategoryKey(parsed.data.name),
      existingKeys.map(category => category.key)
    );
    const categoryId = createId('cat');

    await db.insert(customCategories).values({
      id: categoryId,
      userId: user.id,
      key,
      name: parsed.data.name,
      color: parsed.data.color,
      createdAt: nowIso(),
    });

    return reply.status(201).send({
      category: {
        id: categoryId,
        key,
        name: parsed.data.name,
        color: parsed.data.color,
      },
    });
  });

  app.delete<{ Params: { id: string } }>('/categories/:id', async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    const categoryId = request.params.id;
    const category = await db.query.customCategories.findFirst({
      where: and(eq(customCategories.id, categoryId), eq(customCategories.userId, user.id)),
    });

    if (!category) {
      return reply.status(404).send({ message: 'Category not found' });
    }

    const [usage] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(and(eq(transactions.userId, user.id), eq(transactions.categoryKey, category.key)));

    if (Number(usage?.count ?? 0) > 0) {
      return reply.status(409).send({ message: 'Category is in use and cannot be deleted.' });
    }

    await db.delete(customCategories).where(and(eq(customCategories.id, categoryId), eq(customCategories.userId, user.id)));
    return reply.status(204).send();
  });
}
