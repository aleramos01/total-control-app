import { BankStatementRow, TransactionType } from '../types';
import type { BankStatementParseResult } from './statement-import';

function isValidDateParts(year: number, month: number, day: number) {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function toUtcStoredDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).toISOString();
}

// DTPOSTED: YYYYMMDDHHMMSS or YYYYMMDD (with optional timezone suffix)
function parseDtPosted(value: string): string | null {
  const trimmed = value.trim().replace(/\[.*\]$/, '');
  const match = trimmed.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return isValidDateParts(year, month, day) ? toUtcStoredDate(year, month, day) : null;
}

function normalizeDescription(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSignature(date: string, description: string, amount: number, type: TransactionType) {
  return [date.slice(0, 10), normalizeDescription(description), Math.round(amount * 100), type].join('|');
}

interface OfxRawTransaction {
  TRNTYPE?: string;
  DTPOSTED?: string;
  TRNAMT?: string;
  FITID?: string;
  MEMO?: string;
  NAME?: string;
  CHECKNUM?: string;
}

// Extract leaf field values from SGML block: <FIELDNAME>value (no closing tag)
function extractSgmlFields(block: string): OfxRawTransaction {
  const fields: Record<string, string> = {};
  const re = /<([A-Z0-9]+)>([^<\r\n]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    fields[m[1]] = m[2].trim();
  }
  return fields as OfxRawTransaction;
}

// OFX SGML: extract all STMTTRN blocks (closing tag exists even in SGML)
function parseSgmlOfx(text: string): OfxRawTransaction[] {
  const results: OfxRawTransaction[] = [];
  const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const fields = extractSgmlFields(m[1]);
    if (fields.DTPOSTED && fields.TRNAMT) {
      results.push(fields);
    }
  }
  return results;
}

// OFX 2.x XML: use DOMParser
function parseXmlOfx(text: string): OfxRawTransaction[] {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(text, 'text/xml');
  } catch {
    return [];
  }
  if (doc.querySelector('parsererror')) return [];

  const results: OfxRawTransaction[] = [];
  doc.querySelectorAll('STMTTRN').forEach(node => {
    const fields: Record<string, string> = {};
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        fields[(child as Element).tagName.toUpperCase()] = (child.textContent ?? '').trim();
      }
    });
    if (fields.DTPOSTED && fields.TRNAMT) {
      results.push(fields as OfxRawTransaction);
    }
  });
  return results;
}

function isXmlOfx(text: string): boolean {
  const head = text.trimStart().slice(0, 200);
  return head.startsWith('<?xml') || /<DTPOSTED>[^<]+<\/DTPOSTED>/i.test(head);
}

export function parseOfxFile(text: string): BankStatementParseResult {
  const rawTransactions = isXmlOfx(text) ? parseXmlOfx(text) : parseSgmlOfx(text);

  if (rawTransactions.length === 0) {
    return {
      rows: [],
      errors: [{ lineNumber: 1, message: 'Nenhuma transação encontrada no arquivo OFX.' }],
    };
  }

  const rows: BankStatementRow[] = [];
  const errors: Array<{ lineNumber: number; message: string; raw?: string }> = [];

  rawTransactions.forEach((raw, index) => {
    const lineNumber = index + 1;

    const date = raw.DTPOSTED ? parseDtPosted(raw.DTPOSTED) : null;
    const description = (raw.MEMO || raw.NAME || '').trim();
    const rawAmount = raw.TRNAMT ?? '';
    const signedAmount = Number(rawAmount.replace(',', '.'));
    const fitId = raw.FITID?.trim() || undefined;

    if (!date || !description || !Number.isFinite(signedAmount) || signedAmount === 0) {
      errors.push({
        lineNumber,
        message: 'Linha OFX sem data, descrição ou valor válido.',
        raw: JSON.stringify(raw),
      });
      return;
    }

    // TRNTYPE takes precedence; fall back to sign of TRNAMT
    let type: TransactionType;
    const trnType = (raw.TRNTYPE ?? '').toUpperCase();
    if (trnType === 'CREDIT') {
      type = TransactionType.INCOME;
    } else if (trnType === 'DEBIT' || trnType === 'CHECK' || trnType === 'PAYMENT' || trnType === 'ATM') {
      type = TransactionType.EXPENSE;
    } else {
      type = signedAmount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
    }

    const amount = Math.abs(signedAmount);
    const signature = buildSignature(date, description, amount, type);

    rows.push({
      id: fitId ? `ofx_${fitId}` : `ofx_${lineNumber}_${signature}`,
      lineNumber,
      date,
      description,
      amount,
      type,
      signature,
      raw: raw as Record<string, string>,
      fitId,
    });
  });

  return { rows, errors };
}
