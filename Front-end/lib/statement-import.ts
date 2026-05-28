import {
  BankStatementRow,
  StatementImportAction,
  StatementImportCandidate,
  StatementImportConflict,
  StatementImportDuplicate,
  StatementImportError,
  StatementImportMatch,
  StatementImportNewTransaction,
  StatementImportPreview,
  Transaction,
  TransactionType,
} from '../types';
import { suggestCategoryFromDescription } from './transactions';

const DATE_HEADERS = new Set([
  'data',
  'date',
  'datadomovimento',
  'datamovimento',
  'datalancamento',
  'lancamento',
  'posteddate',
  'transactiondate',
]);

const DESCRIPTION_HEADERS = new Set([
  'descricao',
  'description',
  'historico',
  'memo',
  'detalhes',
  'details',
  'lancamento',
  'merchant',
  'payee',
]);

const AMOUNT_HEADERS = new Set([
  'valor',
  'amount',
  'value',
  'quantia',
  'valorbrl',
  'transactionamount',
]);

const DUPLICATE_IMPORTED_NOTE = 'Importado de extrato CSV';
const MAX_MATCH_DATE_DIFF_DAYS = 3;
const MIN_DESCRIPTION_SIMILARITY = 0.45;
const MIN_MATCH_CONFIDENCE = 0.72;

export interface BankStatementParseResult {
  rows: BankStatementRow[];
  errors: StatementImportError[];
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeHeader(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function normalizeDescription(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string) {
  return normalizeDescription(value)
    .split(' ')
    .filter(token => token.length >= 3);
}

function getDateKey(value: string) {
  return value.slice(0, 10);
}

function toUtcStoredDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).toISOString();
}

function isValidDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseStatementDate(value: string) {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, yearText, monthText, dayText] = isoMatch;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    return isValidDateParts(year, month, day) ? toUtcStoredDate(year, month, day) : null;
  }

  const brMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/);
  if (brMatch) {
    const [, dayText, monthText, yearText] = brMatch;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText.length === 2 ? `20${yearText}` : yearText);
    return isValidDateParts(year, month, day) ? toUtcStoredDate(year, month, day) : null;
  }

  return null;
}

function parseStatementAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isParenthesizedNegative = /^\(.+\)$/.test(trimmed);
  const hasNegativeSign = trimmed.includes('-');
  const withoutCurrency = trimmed
    .replace(/[R$\s]/g, '')
    .replace(/[()]/g, '')
    .replace(/^\+/, '')
    .replace(/-/g, '');

  if (!withoutCurrency) {
    return null;
  }

  const lastComma = withoutCurrency.lastIndexOf(',');
  const lastDot = withoutCurrency.lastIndexOf('.');
  let normalized = withoutCurrency;

  if (lastComma > -1 && lastDot > -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = withoutCurrency
      .replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '')
      .replace(decimalSeparator, '.');
  } else if (lastComma > -1) {
    normalized = withoutCurrency.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = withoutCurrency.replace(/,/g, '');
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) {
    return null;
  }

  const signedAmount = (isParenthesizedNegative || hasNegativeSign) ? -Math.abs(amount) : amount;
  return Math.round(signedAmount * 100) / 100;
}

function cents(value: number) {
  return Math.round(value * 100);
}

function buildStatementSignature(date: string, description: string, amount: number, type: TransactionType) {
  return [
    getDateKey(date),
    normalizeDescription(description),
    cents(amount),
    type,
  ].join('|');
}

export function buildTransactionSignature(transaction: Pick<Transaction, 'date' | 'description' | 'amount' | 'type'>) {
  return buildStatementSignature(transaction.date, transaction.description, transaction.amount, transaction.type);
}

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
}

function detectDelimiter(text: string) {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/).find(line => line.trim()) ?? '';
  return [',', ';', '\t']
    .map(delimiter => ({ delimiter, count: countDelimiter(firstLine, delimiter) }))
    .sort((left, right) => right.count - left.count)[0]?.delimiter ?? ',';
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const delimiter = detectDelimiter(text);

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const nextChar = normalized[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(field);
      field = '';
      continue;
    }

    if (!inQuotes && char === '\n') {
      row.push(field);
      if (row.some(cell => cell.trim())) {
        rows.push(row);
      }
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some(cell => cell.trim())) {
    rows.push(row);
  }

  return rows;
}

function findHeaderIndex(headers: string[], candidates: Set<string>) {
  return headers.findIndex(header => candidates.has(normalizeHeader(header)));
}

export interface CsvHeaderDetection {
  headers: string[];
  sampleRows: string[][];
  dateIndex: number;
  descriptionIndex: number;
  amountIndex: number;
  delimiter: string;
}

export function detectCsvHeaders(text: string): CsvHeaderDetection {
  const csvRows = parseCsvRows(text);
  const delimiter = detectDelimiter(text);

  if (csvRows.length === 0) {
    return { headers: [], sampleRows: [], dateIndex: -1, descriptionIndex: -1, amountIndex: -1, delimiter };
  }

  const [headers, ...rest] = csvRows;
  return {
    headers,
    sampleRows: rest.slice(0, 5),
    dateIndex: findHeaderIndex(headers, DATE_HEADERS),
    descriptionIndex: findHeaderIndex(headers, DESCRIPTION_HEADERS),
    amountIndex: findHeaderIndex(headers, AMOUNT_HEADERS),
    delimiter,
  };
}

export interface CsvColumnMapping {
  dateIndex: number;
  descriptionIndex: number;
  amountIndex: number;
}

export function parseBankStatementCsvWithMapping(text: string, mapping: CsvColumnMapping): BankStatementParseResult {
  const csvRows = parseCsvRows(text);
  const errors: StatementImportError[] = [];

  if (csvRows.length === 0) {
    return { rows: [], errors: [{ lineNumber: 1, message: 'CSV vazio' }] };
  }

  const [headers, ...dataRows] = csvRows;
  const { dateIndex, descriptionIndex, amountIndex } = mapping;
  const rows: BankStatementRow[] = [];

  dataRows.forEach((cells, index) => {
    const lineNumber = index + 2;
    const raw = headers.reduce<Record<string, string>>((acc, header, i) => {
      acc[header] = cells[i]?.trim() ?? '';
      return acc;
    }, {});
    const date = parseStatementDate(cells[dateIndex] ?? '');
    const description = (cells[descriptionIndex] ?? '').trim();
    const signedAmount = parseStatementAmount(cells[amountIndex] ?? '');

    if (!date || !description || signedAmount === null || signedAmount === 0) {
      errors.push({ lineNumber, message: 'Linha sem data, descricao ou valor valido', raw: cells.join(',') });
      return;
    }

    const type = signedAmount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
    const amount = Math.abs(signedAmount);
    const signature = buildStatementSignature(date, description, amount, type);

    rows.push({ id: `stmt_${lineNumber}_${signature}`, lineNumber, date, description, amount, type, signature, raw });
  });

  return { rows, errors };
}

export function parseBankStatementCsv(text: string): BankStatementParseResult {
  const detection = detectCsvHeaders(text);

  if (detection.headers.length === 0) {
    return { rows: [], errors: [{ lineNumber: 1, message: 'CSV vazio' }] };
  }

  if (detection.dateIndex === -1 || detection.descriptionIndex === -1 || detection.amountIndex === -1) {
    return {
      rows: [],
      errors: [{
        lineNumber: 1,
        message: 'Cabecalho do CSV precisa conter data, descricao e valor',
        raw: detection.headers.join(','),
      }],
    };
  }

  return parseBankStatementCsvWithMapping(text, {
    dateIndex: detection.dateIndex,
    descriptionIndex: detection.descriptionIndex,
    amountIndex: detection.amountIndex,
  });
}

function getDateDiffDays(left: string, right: string) {
  const leftDate = new Date(`${getDateKey(left)}T00:00:00.000Z`);
  const rightDate = new Date(`${getDateKey(right)}T00:00:00.000Z`);
  return Math.abs((leftDate.getTime() - rightDate.getTime()) / (24 * 60 * 60 * 1000));
}

function getDescriptionSimilarity(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return normalizeDescription(left) === normalizeDescription(right) ? 1 : 0;
  }

  const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function isLikelyAlreadyImported(transaction: Transaction) {
  if (transaction.notes?.includes(DUPLICATE_IMPORTED_NOTE)) {
    return true;
  }

  return transaction.type === TransactionType.EXPENSE && Boolean(transaction.isPaid);
}

function buildCandidates(row: BankStatementRow, transactions: Transaction[]): StatementImportCandidate[] {
  return transactions
    .filter(transaction => transaction.type === row.type && cents(transaction.amount) === cents(row.amount))
    .map(transaction => {
      const dateDiff = getDateDiffDays(row.date, transaction.date);
      const descriptionSimilarity = getDescriptionSimilarity(row.description, transaction.description);
      const dateScore = dateDiff === 0 ? 1 : Math.max(0, 1 - (dateDiff / MAX_MATCH_DATE_DIFF_DAYS));
      const confidence = (dateScore * 0.45) + (descriptionSimilarity * 0.55);
      return { transaction, confidence };
    })
    .filter(candidate => {
      return getDateDiffDays(row.date, candidate.transaction.date) <= MAX_MATCH_DATE_DIFF_DAYS
        && getDescriptionSimilarity(row.description, candidate.transaction.description) >= MIN_DESCRIPTION_SIMILARITY
        && candidate.confidence >= MIN_MATCH_CONFIDENCE;
    })
    .sort((left, right) => right.confidence - left.confidence);
}

export function buildStatementImportPreview(
  fileName: string,
  parsed: BankStatementParseResult,
  existingTransactions: Transaction[],
  categoryMap: { [key: string]: { name: string } },
  categoryKeys: string[],
): StatementImportPreview {
  const matches: StatementImportMatch[] = [];
  const newTransactions: StatementImportNewTransaction[] = [];
  const duplicates: StatementImportDuplicate[] = [];
  const conflicts: StatementImportConflict[] = [];
  const seenStatementSignatures = new Set<string>();
  const seenFitIds = new Set<string>();
  const existingSignatureMap = new Map(existingTransactions.map(transaction => [buildTransactionSignature(transaction), transaction]));

  parsed.rows.forEach(row => {
    // FITID-based dedup (within file and against already-tagged transactions)
    if (row.fitId) {
      if (seenFitIds.has(row.fitId)) {
        duplicates.push({ row, reason: 'FITID duplicado no arquivo' });
        return;
      }
      seenFitIds.add(row.fitId);
    }

    if (seenStatementSignatures.has(row.signature)) {
      duplicates.push({ row, reason: 'Linha repetida no arquivo' });
      return;
    }
    seenStatementSignatures.add(row.signature);

    const exactExisting = existingSignatureMap.get(row.signature);
    if (exactExisting && isLikelyAlreadyImported(exactExisting)) {
      duplicates.push({ row, transaction: exactExisting, reason: 'Lancamento ja conciliado anteriormente' });
      return;
    }

    const candidates = buildCandidates(row, existingTransactions);
    if (candidates.length === 1) {
      matches.push({
        row,
        transaction: candidates[0].transaction,
        confidence: candidates[0].confidence,
      });
      return;
    }

    if (candidates.length > 1) {
      conflicts.push({
        row,
        reason: 'Mais de uma transacao parecida encontrada',
        candidates,
      });
      return;
    }

    const category = suggestCategoryFromDescription(row.description, row.type, categoryMap, categoryKeys);
    newTransactions.push({
      row,
      transaction: {
        description: row.description,
        amount: row.amount,
        date: row.date,
        type: row.type,
        category,
        scheduleType: 'once',
        seriesId: null,
        installmentIndex: null,
        installmentCount: null,
        isRecurring: false,
        dueDate: null,
        isPaid: row.type === TransactionType.EXPENSE,
        notes: DUPLICATE_IMPORTED_NOTE,
      },
    });
  });

  return {
    fileName,
    totalRows: parsed.rows.length + parsed.errors.length,
    matches,
    newTransactions,
    duplicates,
    conflicts,
    errors: parsed.errors,
  };
}

export function buildStatementImportActions(preview: StatementImportPreview): StatementImportAction[] {
  return [
    ...preview.matches.map(match => ({
      type: 'update' as const,
      transactionId: match.transaction.id,
      amount: match.row.amount,
      isPaid: match.transaction.type === TransactionType.EXPENSE ? true : undefined,
    })),
    ...preview.newTransactions.map(item => ({
      type: 'create' as const,
      transaction: item.transaction,
    })),
  ];
}
