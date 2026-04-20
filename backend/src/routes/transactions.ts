import type { FastifyInstance } from 'fastify';
import { and, desc, eq, gte, like, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { transactions } from '../db/schema.js';
import { getAuthenticatedUser } from '../lib/auth.js';
import { addMonthsToIsoDate, createId, nowIso } from '../lib/utils.js';
import { transactionFiltersSchema, transactionSchema } from '../lib/validators.js';

function buildPresetRange(preset: 'current_month' | 'previous_month' | 'next_30_days' | 'overdue') {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  switch (preset) {
    case 'current_month': {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString();
      return { from, to };
    }
    case 'previous_month': {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
      const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999)).toISOString();
      return { from, to };
    }
    case 'next_30_days': {
      const from = startOfToday.toISOString();
      const to = new Date(startOfToday.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      return { from, to };
    }
    case 'overdue': {
      return {
        from: undefined,
        to: startOfToday.toISOString(),
      };
    }
  }
}

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
    const presetRange = filters.data.preset ? buildPresetRange(filters.data.preset) : null;
    const from = filters.data.from ?? presetRange?.from;
    const to = filters.data.to ?? presetRange?.to;

    if (filters.data.preset === 'next_30_days' || filters.data.preset === 'overdue') {
      conditions.push(eq(transactions.type, 'expense'));
      if (from) {
        conditions.push(gte(transactions.dueDate, from));
      }
      if (to) {
        conditions.push(lte(transactions.dueDate, to));
      }
    } else {
      if (from) {
        conditions.push(gte(transactions.transactionDate, from));
      }
      if (to) {
        conditions.push(lte(transactions.transactionDate, to));
      }
    }
    if (filters.data.preset === 'overdue') {
      conditions.push(eq(transactions.isPaid, false));
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
        scheduleType: row.scheduleType as 'once' | 'recurring' | 'installment',
        seriesId: row.seriesId,
        installmentIndex: row.installmentIndex,
        installmentCount: row.installmentCount,
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
    const scheduleType = parsed.data.scheduleType;
    const installmentCount = scheduleType === 'installment' ? parsed.data.installmentCount : 1;
    const seriesId = installmentCount > 1 ? createId('series') : null;
    const createdTransactions = [];

    for (let index = 0; index < installmentCount; index += 1) {
      const transactionId = createId('txn');
      const nextDate = installmentCount > 1 ? addMonthsToIsoDate(parsed.data.date, index) : parsed.data.date;
      const nextDueDate = parsed.data.dueDate
        ? installmentCount > 1 ? addMonthsToIsoDate(parsed.data.dueDate, index) : parsed.data.dueDate
        : null;

      await db.insert(transactions).values({
        id: transactionId,
        userId: user.id,
        description: installmentCount > 1 ? `${parsed.data.description} (${index + 1}/${installmentCount})` : parsed.data.description,
        amount: parsed.data.amount,
        type: parsed.data.type,
        categoryKey: parsed.data.category,
        transactionDate: nextDate,
        scheduleType,
        seriesId,
        installmentIndex: installmentCount > 1 ? index + 1 : null,
        installmentCount: installmentCount > 1 ? installmentCount : null,
        isRecurring: parsed.data.isRecurring || scheduleType === 'recurring',
        dueDate: nextDueDate,
        isPaid: parsed.data.isPaid,
        notes: parsed.data.notes ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      createdTransactions.push({
        id: transactionId,
        description: installmentCount > 1 ? `${parsed.data.description} (${index + 1}/${installmentCount})` : parsed.data.description,
        amount: parsed.data.amount,
        date: nextDate,
        type: parsed.data.type,
        category: parsed.data.category,
        scheduleType,
        seriesId,
        installmentIndex: installmentCount > 1 ? index + 1 : null,
        installmentCount: installmentCount > 1 ? installmentCount : null,
        isRecurring: parsed.data.isRecurring || scheduleType === 'recurring',
        dueDate: nextDueDate ?? undefined,
        isPaid: parsed.data.isPaid,
        notes: parsed.data.notes ?? null,
      });
    }

    return reply.status(201).send({
      transaction: createdTransactions[0],
      transactions: createdTransactions,
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
        scheduleType: parsed.data.scheduleType,
        seriesId: existing.seriesId,
        installmentIndex: existing.installmentIndex,
        installmentCount: existing.installmentCount,
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
        seriesId: existing.seriesId,
        installmentIndex: existing.installmentIndex,
        installmentCount: existing.installmentCount,
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
        scheduleType: transaction.scheduleType as 'once' | 'recurring' | 'installment',
        seriesId: transaction.seriesId,
        installmentIndex: transaction.installmentIndex,
        installmentCount: transaction.installmentCount,
        isRecurring: transaction.isRecurring,
        dueDate: transaction.dueDate,
        isPaid: body.isPaid,
        notes: transaction.notes,
      },
    });
  });
}
