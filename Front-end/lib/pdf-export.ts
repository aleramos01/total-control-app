import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, TransactionType } from '../types';

interface PdfExportOptions {
  transactions: Transaction[];
  allCategoriesMap: Record<string, { name: string; color: string }>;
  productName: string;
  /** e.g. "R$" | "$" */
  currencySymbol: string;
  /** YYYY-MM (optional, for the report subtitle) */
  period?: string;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10).split('-').reverse().join('/'); // YYYY-MM-DD → DD/MM/YYYY
}

function fmtAmount(amount: number, symbol: string): string {
  return `${symbol} ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function exportTransactionsPdf(options: PdfExportOptions): void {
  const { transactions, allCategoriesMap, productName, currencySymbol, period } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const now = new Date().toLocaleDateString('pt-BR');

  // ── Totals (transfers excluded — they are balance-neutral) ────────────────
  const totalIncome = transactions
    .filter(t => t.type === TransactionType.INCOME && !t.transferToAccountId)
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions
    .filter(t => t.type === TransactionType.EXPENSE && !t.transferToAccountId)
    .reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  // ── Header bar ────────────────────────────────────────────────────────────
  doc.setFillColor(22, 31, 51); // slate-900
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(productName, marginX, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // slate-400
  const subtitle = period
    ? `Extrato · ${period}`
    : `Extrato · gerado em ${now}`;
  doc.text(subtitle, marginX, 20);
  doc.text(`Gerado em ${now}`, pageW - marginX, 20, { align: 'right' });

  // ── Summary cards ─────────────────────────────────────────────────────────
  const cardY = 34;
  const cardH = 16;
  const cardW = (pageW - marginX * 2 - 8) / 3;

  const cards = [
    { label: 'Receitas', value: fmtAmount(totalIncome, currencySymbol), color: [16, 185, 129] as [number,number,number] },
    { label: 'Despesas', value: fmtAmount(totalExpense, currencySymbol), color: [244, 63, 94] as [number,number,number] },
    { label: 'Saldo', value: fmtAmount(balance, currencySymbol), color: balance >= 0 ? [34, 211, 238] as [number,number,number] : [251, 191, 36] as [number,number,number] },
  ];

  cards.forEach((card, i) => {
    const x = marginX + i * (cardW + 4);
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(card.label.toUpperCase(), x + 4, cardY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...card.color);
    doc.text(card.value, x + 4, cardY + 12.5);
  });

  // ── Table ─────────────────────────────────────────────────────────────────
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const tableBody = sorted.map(tx => {
    const isTransfer = Boolean(tx.transferToAccountId);
    const categoryName = isTransfer ? 'Transferência' : (allCategoriesMap[tx.category]?.name ?? tx.category);
    const isExpense = tx.type === TransactionType.EXPENSE && !isTransfer;
    const typeLabel = isTransfer ? 'Transferência' : isExpense ? 'Despesa' : 'Receita';
    return [
      fmtDate(tx.date),
      tx.description,
      categoryName,
      typeLabel,
      fmtAmount(tx.amount, currencySymbol),
    ];
  });

  autoTable(doc, {
    startY: cardY + cardH + 8,
    head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']],
    body: tableBody,
    margin: { left: marginX, right: marginX },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [226, 232, 240], // slate-200
      fillColor: [22, 31, 51],    // slate-900
      lineColor: [51, 65, 85],    // slate-700
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 41, 59],    // slate-800
      textColor: [148, 163, 184], // slate-400
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [26, 35, 50],
    },
    columnStyles: {
      0: { cellWidth: 22 },  // Date
      1: { cellWidth: 'auto' }, // Description (fills remaining)
      2: { cellWidth: 32 },  // Category
      3: { cellWidth: 20 },  // Type
      4: { cellWidth: 30, halign: 'right' }, // Amount
    },
    didParseCell(data) {
      // Color the type column and amount column
      if (data.column.index === 3 && data.section === 'body') {
        const raw = data.cell.raw as string;
        if (raw === 'Transferência') {
          data.cell.styles.textColor = [34, 211, 238]; // cyan
        } else if (raw === 'Despesa') {
          data.cell.styles.textColor = [251, 113, 133]; // rose
        } else {
          data.cell.styles.textColor = [52, 211, 153]; // emerald
        }
      }
      if (data.column.index === 4 && data.section === 'body') {
        const row = sorted[data.row.index];
        if (row) {
          if (row.transferToAccountId) {
            data.cell.styles.textColor = [34, 211, 238]; // cyan for transfers
          } else {
            data.cell.styles.textColor = row.type === TransactionType.EXPENSE
              ? [251, 113, 133]
              : [52, 211, 153];
          }
        }
      }
    },
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  const totalPages = (doc as jsPDF & { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(22, 31, 51);
    doc.rect(0, pageH - 10, pageW, 10, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`${productName} · ${now}`, marginX, pageH - 4);
    doc.text(`Página ${p} de ${totalPages}`, pageW - marginX, pageH - 4, { align: 'right' });
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const filename = `extrato-${period ?? now.split('/').reverse().join('-')}.pdf`;
  doc.save(filename);
}
