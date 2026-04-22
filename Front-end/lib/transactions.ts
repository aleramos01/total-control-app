import { Transaction, TransactionFilters, TransactionType } from '../types';
import { CATEGORY_MAP, CategoryKey } from '../constants';

const CATEGORY_KEYWORDS: Record<CategoryKey, string[]> = {
  salary: [
    'salario',
    'salary',
    'payroll',
    'pagamento empresa',
    'pagamento cliente',
    'pro labore',
    'prolabore',
    'freelance',
    'bonus',
    'bonificacao',
    'comissao',
    'commission',
    'honorario',
    'honorarios',
    'pix cliente',
    'recebimento cliente',
    'receita servico',
    'receita projeto',
  ],
  food: [
    'mercado',
    'supermercado',
    'ifood',
    'restaurante',
    'lanche',
    'almoco',
    'janta',
    'jantar',
    'padaria',
    'cafe',
    'cafeteria',
    'pizzaria',
    'burger',
    'food',
    'meal',
    'delivery',
    'grocery',
    'hortifruti',
    'feira',
  ],
  transport: [
    'uber',
    '99',
    'taxi',
    'onibus',
    'metro',
    'trem',
    'transporte',
    'bilhete unico',
    'passagem',
    'bus',
    'train',
    'subway',
    'transport',
    'aviacao',
    'voo',
    'flight',
    'aeroporto',
  ],
  car: [
    'gasolina',
    'etanol',
    'diesel',
    'posto',
    'carro',
    'estacionamento',
    'pedagio',
    'oficina',
    'mecanico',
    'seguro auto',
    'seguro carro',
    'ipva',
    'licenciamento',
    'combustivel',
    'fuel',
    'parking',
    'toll',
    'car',
    'lavagem carro',
    'manutencao carro',
  ],
  housing: [
    'aluguel',
    'condominio',
    'energia',
    'conta de luz',
    'luz',
    'agua',
    'internet',
    'wifi',
    'moradia',
    'rent',
    'housing',
    'electricity',
    'water',
    'iptu',
    'moveis',
    'reforma',
    'gas encanado',
    'aluguer',
  ],
  leisure: [
    'cinema',
    'show',
    'streaming',
    'netflix',
    'spotify',
    'viagem',
    'lazer',
    'bar',
    'game',
    'games',
    'trip',
    'travel',
    'leisure',
    'teatro',
    'festa',
    'passeio',
    'hotel',
    'airbnb',
    'assinatura',
  ],
  health: [
    'farmacia',
    'medico',
    'dentista',
    'hospital',
    'plano de saude',
    'saude',
    'remedio',
    'consulta',
    'exame',
    'therapy',
    'doctor',
    'health',
    'medicine',
    'psicologo',
    'psicologa',
    'clinica',
  ],
  education: [
    'curso',
    'faculdade',
    'escola',
    'livro',
    'book',
    'education',
    'school',
    'college',
    'tuition',
    'mensalidade escolar',
    'mensalidade faculdade',
    'certificacao',
    'treinamento',
    'workshop',
  ],
  investments: [
    'investimento',
    'investments',
    'acao',
    'acoes',
    'tesouro',
    'cdb',
    'renda fixa',
    'crypto',
    'bitcoin',
    'aporte',
    'dividendo',
    'dividend',
    'selic',
    'fii',
    'etf',
    'poupanca',
    'juros',
    'rendimento',
  ],
  other: [],
};

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function parseStoredDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function extractDateInputValue(value?: string) {
  return value ? value.slice(0, 10) : '';
}

export function formatDatePtBr(value?: string) {
  if (!value) {
    return '';
  }

  const datePart = extractDateInputValue(value);
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) {
    return '';
  }

  return `${day}/${month}/${year}`;
}

function isValidDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseDatePtBr(value: string) {
  const normalized = value.trim();
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);

  if (!isValidDateParts(year, month, day)) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}`;
}

export function toStoredDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function toStoredDateEnd(value: string) {
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

export function buildTransactionQuery(filters: TransactionFilters) {
  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
  if (filters.type) query.set('type', filters.type);
  if (filters.category) query.set('category', filters.category);
  if (filters.status) query.set('status', filters.status);
  if (filters.preset) query.set('preset', filters.preset);
  if (filters.from) query.set('from', new Date(filters.from).toISOString());
  if (filters.to) query.set('to', new Date(filters.to).toISOString());
  const result = query.toString();
  return result ? `?${result}` : '';
}

export function addMonthsToStoredDate(value: string, months: number) {
  const date = parseStoredDate(value);
  date.setMonth(date.getMonth() + months);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)).toISOString();
}

export function formatMonthGroupLabel(value: string, locale: string) {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
}

export function suggestCategoryFromDescription(
  description: string,
  type: TransactionType,
  categoryMap: { [key: string]: { name: string } },
  categoryKeys: string[],
) {
  const normalizedDescription = normalizeSearchValue(description);

  if (!normalizedDescription) {
    return type === TransactionType.INCOME ? 'salary' : 'other';
  }

  const customCategoryMatch = categoryKeys
    .filter(key => !(key in CATEGORY_MAP))
    .find(key => {
      const normalizedName = normalizeSearchValue(categoryMap[key]?.name ?? '');
      return normalizedName && normalizedDescription.includes(normalizedName);
    });

  if (customCategoryMatch) {
    return customCategoryMatch;
  }

  const orderedCategories = type === TransactionType.INCOME
    ? (['salary', 'investments', 'other'] satisfies CategoryKey[])
    : (['food', 'transport', 'car', 'housing', 'health', 'education', 'leisure', 'other'] satisfies CategoryKey[]);

  for (const categoryKey of orderedCategories) {
    const keywords = CATEGORY_KEYWORDS[categoryKey];
    if (keywords.some(keyword => normalizedDescription.includes(keyword))) {
      return categoryKey;
    }
  }

  return type === TransactionType.INCOME ? 'salary' : 'other';
}

export function buildTransactionsCsv(
  transactions: Transaction[],
  categoryMap: { [key: string]: { name: string } }
) {
  const rows = transactions.map(transaction => [
    transaction.id,
    transaction.description,
    transaction.amount.toFixed(2),
    transaction.date,
    transaction.type,
    categoryMap[transaction.category]?.name || transaction.category,
    transaction.dueDate ?? '',
    transaction.isPaid ? 'paid' : 'unpaid',
  ]);

  return [['id', 'description', 'amount', 'date', 'type', 'category', 'dueDate', 'status'], ...rows]
    .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export interface UpcomingBill extends Transaction {
  diffDays: number;
}

export function getUpcomingBills(transactions: Transaction[], today = new Date()): UpcomingBill[] {
  const normalizedToday = new Date(today);
  normalizedToday.setHours(0, 0, 0, 0);

  return transactions
    .filter(transaction => transaction.type === TransactionType.EXPENSE && transaction.isRecurring && transaction.dueDate)
    .map(transaction => {
      const dueDate = parseStoredDate(transaction.dueDate!);
      const diffDays = Math.ceil((dueDate.getTime() - normalizedToday.getTime()) / (1000 * 60 * 60 * 24));
      return { ...transaction, diffDays };
    })
    .filter(transaction => transaction.diffDays <= 30)
    .sort((left, right) => left.diffDays - right.diffDays);
}
