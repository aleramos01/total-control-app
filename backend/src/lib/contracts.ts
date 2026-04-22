export const userRoles = ['admin', 'user'] as const;
export type UserRole = (typeof userRoles)[number];

export const userStatuses = ['active'] as const;
export type UserStatus = (typeof userStatuses)[number];

export const transactionTypes = ['income', 'expense'] as const;
export type TransactionType = (typeof transactionTypes)[number];

export const scheduleTypes = ['once', 'recurring', 'installment'] as const;
export type ScheduleType = (typeof scheduleTypes)[number];

export const currencies = ['BRL', 'USD'] as const;
export type Currency = (typeof currencies)[number];

export const locales = ['pt-BR', 'en-US'] as const;
export type AppLocale = (typeof locales)[number];
