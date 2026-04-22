import { z } from 'zod';
import { currencies, locales, scheduleTypes, transactionTypes } from './contracts.js';

const hexColor = /^#([0-9a-fA-F]{6})$/;

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(128),
  rememberMe: z.boolean().optional().default(true),
});

export const inviteRegisterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(128),
  inviteCode: z.string().trim().min(6).max(32),
});

export const createInviteSchema = z.object({
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

export const transactionSchema = z.object({
  description: z.string().trim().min(2).max(140),
  amount: z.number().positive().max(999999999),
  date: z.string().datetime(),
  type: z.enum(transactionTypes),
  category: z.string().trim().min(2).max(60),
  scheduleType: z.enum(scheduleTypes).optional().default('once'),
  installmentCount: z.number().int().min(1).max(36).optional().default(1),
  isRecurring: z.boolean().optional().default(false),
  dueDate: z.string().datetime().optional().nullable(),
  isPaid: z.boolean().optional().default(false),
  notes: z.string().trim().max(240).optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.scheduleType === 'installment' && value.installmentCount < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['installmentCount'],
      message: 'Installment count must be at least 2 for installment schedules',
    });
  }
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
  currency: z.enum(currencies),
  locale: z.enum(locales),
  timezone: z.string().trim().min(2).max(60),
  billingDayDefault: z.number().int().min(1).max(31),
});

export const transactionFiltersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  type: z.enum(transactionTypes).optional(),
  category: z.string().trim().max(60).optional(),
  status: z.enum(['paid', 'unpaid']).optional(),
  preset: z.enum(['current_month', 'previous_month', 'next_30_days', 'overdue']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).superRefine((value, ctx) => {
  if (value.from && value.to && new Date(value.from).getTime() > new Date(value.to).getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['to'],
      message: 'End date must be greater than or equal to start date',
    });
  }
});

export const transactionPaymentStatusSchema = z.object({
  isPaid: z.boolean(),
});

export const importPayloadSchema = z.object({
  transactions: z.array(transactionSchema).default([]),
  categories: z.array(categorySchema).default([]),
});
