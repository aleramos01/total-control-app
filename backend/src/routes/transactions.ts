import type { FastifyInstance } from 'fastify';
import { and, desc, eq, gte, like, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { transactions } from '../db/schema.js';
import { getAuthenticatedUser } from '../lib/auth.js';
import { createId, nowIso } from '../lib/utils.js';
import { transactionFiltersSchema, transactionSchema } from '../lib/validators.js';

export async function transactionRoutes(app: FastifyInstance) {
  app.get('/transactions', async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    const filters = transactionFiltersSchema.safeParse(request.query);
    if (!filters.success) {
      return reply.status(400).send({ message: 'Invalid filters', issues: filters.error.flatten() });
    }

    const conditions = [eq(transactions.userId, user.id)];

    if (filters.data.q) {
      conditions.push(like(transactions.description, `%${filters.data.q}%`));
    }
    if (filters.data.type) {
      conditions.push(eq(transactions.type, filters.data.type));
    }
    if (filters.data.category) {
      conditions.push(eq(transactions.categoryKey, filters.data.category));
    }
    if (filters.data.status === 'paid') {
      conditions.push(eq(transactions.isPaid, true));
    }
    if (filters.data.status === 'unpaid') {
      conditions.push(eq(transactions.isPaid, false));
    }
    if (filters.data.from) {
      conditions.push(gte(transactions.transactionDate, filters.data.from));
    }
    if (filters.data.to) {
      conditions.push(lte(transactions.transactionDate, filters.data.to));
    }

    const rows = await db.query.transactions.findMany({
      where: and(...conditions),
      orderBy: [desc(transactions.transactionDate)],
    });

    return reply.send({
      transactions: rows.map(row => ({
        id: row.id,
        description: row.description,
        amount: row.amount,
        date: row.transactionDate,
        type: row.type,
        category: row.categoryKey,
        isRecurring: row.isRecurring,
        dueDate: row.dueDate,
        isPaid: row.isPaid,
        notes: row.notes,
      })),
    });
  });

  app.post('/transactions', async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    const parsed = transactionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Invalid transaction payload', issues: parsed.error.flatten() });
    }

    const timestamp = nowIso();
    const transactionId = createId('txn');

    await db.insert(transactions).values({
      id: transactionId,
      userId: user.id,
      description: parsed.data.description,
      amount: parsed.data.amount,
      type: parsed.data.type,
      categoryKey: parsed.data.category,
      transactionDate: parsed.data.date,
      isRecurring: parsed.data.isRecurring,
      dueDate: parsed.data.dueDate ?? null,
      isPaid: parsed.data.isPaid,
      notes: parsed.data.notes ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return reply.status(201).send({
      transaction: {
        id: transactionId,
        ...parsed.data,
      },
    });
  });

  app.put('/transactions/:id', async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    const parsed = transactionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Invalid transaction payload', issues: parsed.error.flatten() });
    }

    const existing = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, String((request.params as { id: string }).id)), eq(transactions.userId, user.id)),
    });

    if (!existing) {
      return reply.status(404).send({ message: 'Transaction not found' });
    }

    await db
      .update(transactions)
      .set({
        description: parsed.data.description,
        amount: parsed.data.amount,
        type: parsed.data.type,
        categoryKey: parsed.data.category,
        transactionDate: parsed.data.date,
        isRecurring: parsed.data.isRecurring,
        dueDate: parsed.data.dueDate ?? null,
        isPaid: parsed.data.isPaid,
        notes: parsed.data.notes ?? null,
        updatedAt: nowIso(),
      })
      .where(and(eq(transactions.id, existing.id), eq(transactions.userId, user.id)));

    return reply.send({
      transaction: {
        id: existing.id,
        ...parsed.data,
      },
    });
  });

  app.delete('/transactions/:id', async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    await db
      .delete(transactions)
      .where(and(eq(transactions.id, String((request.params as { id: string }).id)), eq(transactions.userId, user.id)));

    return reply.status(204).send();
  });

  app.patch('/transactions/:id/payment-status', async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    const body = request.body as { isPaid?: boolean };
    if (typeof body?.isPaid !== 'boolean') {
      return reply.status(400).send({ message: 'isPaid must be a boolean' });
    }

    const transaction = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, String((request.params as { id: string }).id)), eq(transactions.userId, user.id)),
    });

    if (!transaction) {
      return reply.status(404).send({ message: 'Transaction not found' });
    }

    await db
      .update(transactions)
      .set({ isPaid: body.isPaid, updatedAt: nowIso() })
      .where(and(eq(transactions.id, transaction.id), eq(transactions.userId, user.id)));

    return reply.send({
      transaction: {
        id: transaction.id,
        description: transaction.description,
        amount: transaction.amount,
        date: transaction.transactionDate,
        type: transaction.type,
        category: transaction.categoryKey,
        isRecurring: transaction.isRecurring,
        dueDate: transaction.dueDate,
        isPaid: body.isPaid,
        notes: transaction.notes,
      },
    });
  });
}
