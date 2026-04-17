import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { customCategories, transactions } from '../db/schema.js';
import { getAuthenticatedUser } from '../lib/auth.js';
import { buildUniqueCategoryKey, normalizeCategoryKey, resolveImportedTransactionCategory } from '../lib/categories.js';
import { createId, nowIso } from '../lib/utils.js';
import { importPayloadSchema } from '../lib/validators.js';

export async function importExportRoutes(app: FastifyInstance) {
  app.get('/export/json', async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    const [userTransactions, userCategories] = await Promise.all([
      db.query.transactions.findMany({ where: eq(transactions.userId, user.id) }),
      db.query.customCategories.findMany({ where: eq(customCategories.userId, user.id) }),
    ]);

    return reply.send({
      exportedAt: nowIso(),
      transactions: userTransactions.map(item => ({
        description: item.description,
        amount: item.amount,
        date: item.transactionDate,
        type: item.type,
        category: item.categoryKey,
        isRecurring: item.isRecurring,
        dueDate: item.dueDate,
        isPaid: item.isPaid,
        notes: item.notes,
      })),
      categories: userCategories.map(item => ({
        key: item.key,
        name: item.name,
        color: item.color,
      })),
    });
  });

  app.post('/import/json', async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    const parsed = importPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Invalid import payload', issues: parsed.error.flatten() });
    }

    const timestamp = nowIso();
    const existingCategories = await db.query.customCategories.findMany({
      where: eq(customCategories.userId, user.id),
    });
    const existingCategoryKeys = new Set(existingCategories.map(category => category.key));
    const categoryKeyMap = new Map<string, string>();
    const existingCategoryMap = new Map(existingCategories.map(category => [category.key, category]));

    for (const category of parsed.data.categories) {
      const sourceKey = category.key ? normalizeCategoryKey(category.key) : normalizeCategoryKey(category.name);
      const existingCategory = existingCategoryMap.get(sourceKey);

      if (existingCategory) {
        categoryKeyMap.set(sourceKey, existingCategory.key);
        await db
          .update(customCategories)
          .set({
            name: category.name,
            color: category.color,
          })
          .where(eq(customCategories.id, existingCategory.id));
        continue;
      }

      const finalKey = buildUniqueCategoryKey(sourceKey, existingCategoryKeys);
      existingCategoryKeys.add(finalKey);
      categoryKeyMap.set(sourceKey, finalKey);
      existingCategoryMap.set(sourceKey, {
        id: createId('cat_preview'),
        userId: user.id,
        key: finalKey,
        name: category.name,
        color: category.color,
        createdAt: timestamp,
      });

      await db.insert(customCategories).values({
        id: createId('cat'),
        userId: user.id,
        key: finalKey,
        name: category.name,
        color: category.color,
        createdAt: timestamp,
      });
    }

    for (const transaction of parsed.data.transactions) {
      const importedCategory = categoryKeyMap.get(transaction.category) ?? transaction.category;

      await db.insert(transactions).values({
        id: createId('txn'),
        userId: user.id,
        description: transaction.description,
        amount: transaction.amount,
        type: transaction.type,
        categoryKey: resolveImportedTransactionCategory(importedCategory, existingCategoryKeys),
        transactionDate: transaction.date,
        isRecurring: transaction.isRecurring,
        dueDate: transaction.dueDate ?? null,
        isPaid: transaction.isPaid,
        notes: transaction.notes ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return reply.status(201).send({
      message: 'Import completed successfully',
      imported: {
        transactions: parsed.data.transactions.length,
        categories: parsed.data.categories.length,
      },
    });
  });
}
