import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { buildUniqueCategoryKey, normalizeCategoryKey } from '../lib/categories.js';
import { createId } from '../lib/utils.js';
import { closeDb, db } from './client.js';
import { customCategories, sessions, transactions, users } from './schema.js';
import { ensureDatabase } from './init.js';

const demoAccount = {
  name: process.env.DEMO_USER_NAME?.trim() || 'Conta Demonstracao',
  email: process.env.DEMO_USER_EMAIL?.trim().toLowerCase() || 'demo@totalcontrol.app',
  password: process.env.DEMO_USER_PASSWORD || 'Demo@123456',
};

const demoCategories = [
  { name: 'Pets', color: '#F97316' },
  { name: 'Assinaturas', color: '#8B5CF6' },
  { name: 'Viagens', color: '#06B6D4' },
  { name: 'Home Office', color: '#14B8A6' },
];

type TransactionSeed = {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  categoryKey: string;
  date: string;
  scheduleType?: 'once' | 'recurring' | 'installment';
  seriesId?: string | null;
  installmentIndex?: number | null;
  installmentCount?: number | null;
  isRecurring?: boolean;
  dueDate?: string | null;
  isPaid?: boolean;
  notes?: string | null;
};

function isoUtcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0, 0)).toISOString();
}

function clampDay(year: number, monthIndex: number, preferredDay: number) {
  return Math.min(preferredDay, new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate());
}

function monthDate(reference: Date, monthOffset: number, day: number) {
  const year = reference.getUTCFullYear();
  const monthIndex = reference.getUTCMonth() + monthOffset;
  const date = new Date(Date.UTC(year, monthIndex, 1, 12, 0, 0, 0));
  const resolvedDay = clampDay(date.getUTCFullYear(), date.getUTCMonth(), day);
  return isoUtcDate(date.getUTCFullYear(), date.getUTCMonth(), resolvedDay);
}

function createTransaction(seed: TransactionSeed, userId: string, timestamp: string) {
  return {
    id: createId('txn'),
    userId,
    description: seed.description,
    amount: seed.amount,
    type: seed.type,
    categoryKey: seed.categoryKey,
    transactionDate: seed.date,
    scheduleType: seed.scheduleType ?? 'once',
    seriesId: seed.seriesId ?? null,
    installmentIndex: seed.installmentIndex ?? null,
    installmentCount: seed.installmentCount ?? null,
    isRecurring: seed.isRecurring ?? false,
    dueDate: seed.dueDate ?? null,
    isPaid: seed.isPaid ?? false,
    notes: seed.notes ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildDemoTransactions(today = new Date()) {
  const currentWeekday = today.getUTCDay();
  const weekStart = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() - currentWeekday,
    12,
    0,
    0,
    0,
  ));

  const seriesLaptop = createId('series');
  const seriesPhone = createId('series');
  const rows: TransactionSeed[] = [];

  for (const monthOffset of [-3, -2, -1, 0]) {
    rows.push(
      {
        description: 'Salario Empresa Atlas',
        amount: 7800 + (monthOffset + 3) * 120,
        type: 'income',
        categoryKey: 'salary',
        date: monthDate(today, monthOffset, 5),
        scheduleType: 'recurring',
        isRecurring: true,
        dueDate: monthDate(today, monthOffset, 5),
        isPaid: true,
        notes: 'Receita principal mensal.',
      },
      {
        description: 'Freelance Landing Page',
        amount: 1800 + (monthOffset + 3) * 150,
        type: 'income',
        categoryKey: 'salary',
        date: monthDate(today, monthOffset, 18),
        scheduleType: 'once',
        isPaid: true,
        notes: 'Projeto pontual para complementar o caixa.',
      },
      {
        description: 'Aluguel Apartamento',
        amount: 2350,
        type: 'expense',
        categoryKey: 'housing',
        date: monthDate(today, monthOffset, 5),
        scheduleType: 'recurring',
        isRecurring: true,
        dueDate: monthDate(today, monthOffset, 5),
        isPaid: true,
      },
      {
        description: 'Condominio',
        amount: 690,
        type: 'expense',
        categoryKey: 'housing',
        date: monthDate(today, monthOffset, 7),
        scheduleType: 'recurring',
        isRecurring: true,
        dueDate: monthDate(today, monthOffset, 7),
        isPaid: true,
      },
      {
        description: 'Supermercado Central',
        amount: 980 + (monthOffset + 3) * 60,
        type: 'expense',
        categoryKey: 'food',
        date: monthDate(today, monthOffset, 9),
        isPaid: true,
      },
      {
        description: 'Restaurante de Equipe',
        amount: 180 + (monthOffset + 3) * 12,
        type: 'expense',
        categoryKey: 'food',
        date: monthDate(today, monthOffset, 14),
        isPaid: true,
      },
      {
        description: 'Uber Clientes',
        amount: 220 + (monthOffset + 3) * 18,
        type: 'expense',
        categoryKey: 'transport',
        date: monthDate(today, monthOffset, 11),
        isPaid: true,
      },
      {
        description: 'Plano de Saude Familiar',
        amount: 540,
        type: 'expense',
        categoryKey: 'health',
        date: monthDate(today, monthOffset, 12),
        scheduleType: 'recurring',
        isRecurring: true,
        dueDate: monthDate(today, monthOffset, 12),
        isPaid: true,
      },
      {
        description: 'Curso de Gestao Financeira',
        amount: 260,
        type: 'expense',
        categoryKey: 'education',
        date: monthDate(today, monthOffset, 16),
        isPaid: true,
      },
      {
        description: 'Aporte Tesouro Selic',
        amount: 900 + (monthOffset + 3) * 80,
        type: 'expense',
        categoryKey: 'investments',
        date: monthDate(today, monthOffset, 20),
        isPaid: true,
      },
      {
        description: 'Streaming e Musica',
        amount: 89.9,
        type: 'expense',
        categoryKey: 'assinaturas',
        date: monthDate(today, monthOffset, 8),
        scheduleType: 'recurring',
        isRecurring: true,
        dueDate: monthDate(today, monthOffset, 8),
        isPaid: true,
      },
      {
        description: 'Racao e Veterinario',
        amount: 260 + (monthOffset + 3) * 20,
        type: 'expense',
        categoryKey: 'pets',
        date: monthDate(today, monthOffset, 21),
        isPaid: true,
      },
      {
        description: 'Internet Fibra',
        amount: 129.9,
        type: 'expense',
        categoryKey: 'home_office',
        date: monthDate(today, monthOffset, 10),
        scheduleType: 'recurring',
        isRecurring: true,
        dueDate: monthDate(today, monthOffset, 10),
        isPaid: true,
      },
    );
  }

  for (let index = 0; index < 6; index += 1) {
    const billDate = monthDate(today, -2 + index, 22);
    rows.push({
      description: `Notebook Dell Parcela ${index + 1}/6`,
      amount: 650,
      type: 'expense',
      categoryKey: 'home_office',
      date: billDate,
      scheduleType: 'installment',
      seriesId: seriesLaptop,
      installmentIndex: index + 1,
      installmentCount: 6,
      dueDate: billDate,
      isPaid: index < 3,
      notes: 'Compra parcelada para a conta demonstracao.',
    });
  }

  for (let index = 0; index < 4; index += 1) {
    const billDate = monthDate(today, -1 + index, 28);
    rows.push({
      description: `iPhone Parcela ${index + 1}/4`,
      amount: 430,
      type: 'expense',
      categoryKey: 'other',
      date: billDate,
      scheduleType: 'installment',
      seriesId: seriesPhone,
      installmentIndex: index + 1,
      installmentCount: 4,
      dueDate: billDate,
      isPaid: index < 2,
    });
  }

  rows.push(
    {
      description: 'Passagens para evento de vendas',
      amount: 1480,
      type: 'expense',
      categoryKey: 'viagens',
      date: monthDate(today, -2, 24),
      isPaid: true,
      notes: 'Despesa sazonal para enriquecer os graficos.',
    },
    {
      description: 'Hotel evento regional',
      amount: 960,
      type: 'expense',
      categoryKey: 'viagens',
      date: monthDate(today, -2, 26),
      isPaid: true,
    },
    {
      description: 'Cinema e jantar',
      amount: 240,
      type: 'expense',
      categoryKey: 'leisure',
      date: monthDate(today, -1, 19),
      isPaid: true,
    },
    {
      description: 'Bonus trimestral',
      amount: 3200,
      type: 'income',
      categoryKey: 'salary',
      date: monthDate(today, -1, 25),
      isPaid: true,
      notes: 'Entrada extra para melhorar a serie historica.',
    },
    {
      description: 'Mercado da semana',
      amount: 312.45,
      type: 'expense',
      categoryKey: 'food',
      date: isoUtcDate(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), clampDay(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 1)),
      isPaid: true,
    },
    {
      description: 'Cafe com cliente',
      amount: 48.7,
      type: 'expense',
      categoryKey: 'food',
      date: isoUtcDate(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), clampDay(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 2)),
      isPaid: true,
    },
    {
      description: 'Combustivel',
      amount: 220,
      type: 'expense',
      categoryKey: 'car',
      date: isoUtcDate(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), clampDay(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 3)),
      isPaid: true,
    },
    {
      description: 'Assinatura SaaS Financeiro',
      amount: 149.9,
      type: 'expense',
      categoryKey: 'assinaturas',
      date: monthDate(today, 0, 27),
      scheduleType: 'recurring',
      isRecurring: true,
      dueDate: monthDate(today, 1, 27),
      isPaid: false,
    },
    {
      description: 'Internet Fibra Proximo Ciclo',
      amount: 129.9,
      type: 'expense',
      categoryKey: 'home_office',
      date: monthDate(today, 1, 10),
      scheduleType: 'recurring',
      isRecurring: true,
      dueDate: monthDate(today, 1, 10),
      isPaid: false,
    },
    {
      description: 'Plano de Saude Proximo Ciclo',
      amount: 540,
      type: 'expense',
      categoryKey: 'health',
      date: monthDate(today, 1, 12),
      scheduleType: 'recurring',
      isRecurring: true,
      dueDate: monthDate(today, 1, 12),
      isPaid: false,
    },
    {
      description: 'Aluguel Proximo Mes',
      amount: 2350,
      type: 'expense',
      categoryKey: 'housing',
      date: monthDate(today, 1, 5),
      scheduleType: 'recurring',
      isRecurring: true,
      dueDate: monthDate(today, 1, 5),
      isPaid: false,
    },
  );

  return rows;
}

async function seedDemoAccount() {
  await ensureDatabase();

  const timestamp = new Date().toISOString();
  const passwordHash = await argon2.hash(demoAccount.password);
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, demoAccount.email),
  });

  const userId = existingUser?.id ?? createId('user');

  if (existingUser) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await db.delete(transactions).where(eq(transactions.userId, userId));
    await db.delete(customCategories).where(eq(customCategories.userId, userId));

    await db
      .update(users)
      .set({
        name: demoAccount.name,
        passwordHash,
        role: 'user',
        status: 'active',
        updatedAt: timestamp,
      })
      .where(eq(users.id, userId));
  } else {
    await db.insert(users).values({
      id: userId,
      name: demoAccount.name,
      email: demoAccount.email,
      passwordHash,
      role: 'user',
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  const usedKeys = new Set<string>();
  const seededCategories = demoCategories.map(category => {
    const key = buildUniqueCategoryKey(normalizeCategoryKey(category.name), usedKeys);
    usedKeys.add(key);
    return {
      id: createId('cat'),
      userId,
      key,
      name: category.name,
      color: category.color,
      createdAt: timestamp,
    };
  });

  await db.insert(customCategories).values(seededCategories);
  await db.insert(transactions).values(buildDemoTransactions().map(seed => createTransaction(seed, userId, timestamp)));

  console.log(JSON.stringify({
    seeded: true,
    user: {
      email: demoAccount.email,
      password: demoAccount.password,
      name: demoAccount.name,
    },
    transactions: buildDemoTransactions().length,
    categories: seededCategories.length,
  }, null, 2));
}

try {
  await seedDemoAccount();
} finally {
  await closeDb();
}
