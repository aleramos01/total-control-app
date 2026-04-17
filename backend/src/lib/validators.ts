import { z } from 'zod';

const hexColor = /^#([0-9a-fA-F]{6})$/;

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(128),
});

export const transactionSchema = z.object({
  description: z.string().trim().min(2).max(140),
  amount: z.number().positive().max(999999999),
  date: z.string().datetime(),
  type: z.enum(['income', 'expense']),
  category: z.string().trim().min(2).max(60),
  isRecurring: z.boolean().optional().default(false),
  dueDate: z.string().datetime().optional().nullable(),
  isPaid: z.boolean().optional().default(false),
  notes: z.string().trim().max(240).optional().nullable(),
});

export const categorySchema = z.object({
  key: z.string().trim().min(2).max(80).optional(),
  name: z.string().trim().min(2).max(40),
  color: z.string().regex(hexColor),
});

export const brandSettingsSchema = z.object({
  productName: z.string().trim().min(2).max(80),
  logoUrl: z.string().trim().url().optional().or(z.literal('')).nullable(),
  faviconUrl: z.string().trim().url().optional().or(z.literal('')).nullable(),
  primaryColor: z.string().regex(hexColor),
  accentColor: z.string().regex(hexColor),
  surfaceColor: z.string().regex(hexColor),
  textColor: z.string().regex(hexColor),
  supportEmail: z.string().trim().email().optional().or(z.literal('')).nullable(),
  marketingHeadline: z.string().trim().min(4).max(140),
});

export const appSettingsSchema = z.object({
  currency: z.enum(['BRL', 'USD']),
  locale: z.enum(['pt-BR', 'en-US']),
  timezone: z.string().trim().min(2).max(60),
  billingDayDefault: z.number().int().min(1).max(31),
});

export const transactionFiltersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().trim().max(60).optional(),
  status: z.enum(['paid', 'unpaid']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const importPayloadSchema = z.object({
  transactions: z.array(transactionSchema).default([]),
  categories: z.array(categorySchema).default([]),
});
