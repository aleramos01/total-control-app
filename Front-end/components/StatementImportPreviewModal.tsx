import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import {
  BankStatementRow,
  StatementImportAction,
  StatementImportPreview,
  TransactionType,
} from '../types';

interface RowEditState {
  selected: boolean;
  description: string;
  category: string;
  type: TransactionType;
}

type RowKind = 'new' | 'match' | 'duplicate' | 'conflict' | 'error';

interface PreviewTableRow {
  key: string;
  kind: RowKind;
  row: BankStatementRow;
  defaultCategory: string;
  canSelect: boolean;
  defaultSelected: boolean;
  matchTransactionId?: string;
  matchIsPaid?: boolean;
  hintKey: keyof ReturnType<typeof useLanguage>['t'] extends (key: infer K) => string ? K : never;
}

interface StatementImportPreviewModalProps {
  isOpen: boolean;
  preview: StatementImportPreview | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (actions: StatementImportAction[]) => void;
  allCategoriesMap: { [key: string]: { name: string; color?: string } };
}

const NOTES_CSV = 'Importado de extrato CSV';
const NOTES_FORCE = 'Importado de extrato (forçado)';

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: '2-digit' });
}

const KindBadge: React.FC<{ kind: RowKind; label: string }> = ({ kind, label }) => {
  const cls = {
    new: 'border-emerald-400/25 bg-emerald-500/15 text-emerald-300',
    match: 'border-cyan-400/25 bg-cyan-500/15 text-cyan-300',
    duplicate: 'border-amber-400/25 bg-amber-500/15 text-amber-300',
    conflict: 'border-orange-400/25 bg-orange-500/15 text-orange-300',
    error: 'border-rose-400/25 bg-rose-500/15 text-rose-300',
  }[kind];
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
};

const StatementImportPreviewModal: React.FC<StatementImportPreviewModalProps> = ({
  isOpen,
  preview,
  isSubmitting,
  onClose,
  onConfirm,
  allCategoriesMap,
}) => {
  const { t, formatCurrency } = useLanguage();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const allCategoryKeys = useMemo(() => Object.keys(allCategoriesMap), [allCategoriesMap]);

  // Build unified list of preview rows
  const tableRows = useMemo((): PreviewTableRow[] => {
    if (!preview) return [];
    const rows: PreviewTableRow[] = [];

    preview.newTransactions.forEach(item => {
      rows.push({
        key: `new-${item.row.id}`,
        kind: 'new',
        row: item.row,
        defaultCategory: item.transaction.category,
        canSelect: true,
        defaultSelected: true,
        hintKey: 'statement_preview_row_new' as never,
      });
    });

    preview.matches.forEach(match => {
      rows.push({
        key: `match-${match.row.id}`,
        kind: 'match',
        row: match.row,
        defaultCategory: match.transaction.category,
        canSelect: true,
        defaultSelected: true,
        matchTransactionId: match.transaction.id,
        // Only mark as paid if the statement row date is today or in the past.
        // Future-dated expenses (e.g. scheduled payments) should not be prematurely paid.
        matchIsPaid: match.transaction.type === TransactionType.EXPENSE
          && match.row.date.slice(0, 10) <= new Date().toISOString().slice(0, 10)
          ? true : undefined,
        hintKey: 'statement_preview_row_update' as never,
      });
    });

    preview.duplicates.forEach(dup => {
      rows.push({
        key: `dup-${dup.row.id}`,
        kind: 'duplicate',
        row: dup.row,
        defaultCategory: 'other',
        canSelect: true,
        defaultSelected: false,
        hintKey: 'statement_preview_duplicate_hint' as never,
      });
    });

    preview.conflicts.forEach(conflict => {
      rows.push({
        key: `conflict-${conflict.row.id}`,
        kind: 'conflict',
        row: conflict.row,
        defaultCategory: 'other',
        canSelect: true,
        defaultSelected: false,
        hintKey: 'statement_preview_conflict_hint' as never,
      });
    });

    preview.errors.forEach(error => {
      const fakeRow: BankStatementRow = {
        id: `err-${error.lineNumber}`,
        lineNumber: error.lineNumber,
        date: new Date().toISOString(),
        description: error.message,
        amount: 0,
        type: TransactionType.EXPENSE,
        signature: '',
        raw: {},
      };
      rows.push({
        key: `err-${error.lineNumber}`,
        kind: 'error',
        row: fakeRow,
        defaultCategory: 'other',
        canSelect: false,
        defaultSelected: false,
        hintKey: 'statement_preview_error_hint' as never,
      });
    });

    return rows;
  }, [preview]);

  // Per-row edit state
  const [rowStates, setRowStates] = useState<Record<string, RowEditState>>({});

  // Re-initialize when preview changes
  useEffect(() => {
    if (!preview) return;
    const initial: Record<string, RowEditState> = {};
    tableRows.forEach(tr => {
      initial[tr.key] = {
        selected: tr.defaultSelected,
        description: tr.row.description,
        category: tr.defaultCategory,
        type: tr.row.type,
      };
    });
    setRowStates(initial);
  }, [preview, tableRows]);

  // Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isSubmitting, onClose]);

  const setRowField = useCallback(<K extends keyof RowEditState>(key: string, field: K, value: RowEditState[K]) => {
    setRowStates(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }, []);

  const selectableKeys = useMemo(() => tableRows.filter(r => r.canSelect).map(r => r.key), [tableRows]);
  const selectedCount = useMemo(
    () => selectableKeys.filter(k => rowStates[k]?.selected).length,
    [selectableKeys, rowStates],
  );
  const allSelected = selectedCount === selectableKeys.length && selectableKeys.length > 0;

  const toggleAll = useCallback(() => {
    const next = !allSelected;
    setRowStates(prev => {
      const updated = { ...prev };
      selectableKeys.forEach(k => { updated[k] = { ...updated[k], selected: next }; });
      return updated;
    });
  }, [allSelected, selectableKeys]);

  const handleConfirm = useCallback(() => {
    if (!preview) return;
    const actions: StatementImportAction[] = [];

    tableRows.forEach(tr => {
      const state = rowStates[tr.key];
      if (!state?.selected) return;

      if (tr.kind === 'match' && tr.matchTransactionId != null && tr.matchTransactionId !== '') {
        actions.push({
          type: 'update',
          transactionId: tr.matchTransactionId,
          amount: tr.row.amount,
          isPaid: tr.matchIsPaid,
        });
        return;
      }

      // new / forced duplicate / forced conflict
      actions.push({
        type: 'create',
        transaction: {
          description: state.description,
          amount: tr.row.amount,
          date: tr.row.date,
          type: state.type,
          category: state.category || 'other',
          scheduleType: 'once',
          seriesId: null,
          installmentIndex: null,
          installmentCount: null,
          isRecurring: false,
          dueDate: null,
          isPaid: state.type === TransactionType.EXPENSE,
          notes: tr.kind === 'new' ? NOTES_CSV : NOTES_FORCE,
        },
      });
    });

    onConfirm(actions);
  }, [onConfirm, preview, rowStates, tableRows]);

  if (!isOpen || !preview) return null;

  const rowBg = (kind: RowKind) => ({
    new: '',
    match: 'bg-cyan-500/5',
    duplicate: 'bg-amber-500/8',
    conflict: 'bg-orange-500/8',
    error: 'bg-rose-500/8 opacity-60',
  }[kind]);

  const kindLabel = (kind: RowKind) => ({
    new: t('statement_preview_row_new'),
    match: t('statement_preview_row_update'),
    duplicate: t('statement_preview_row_duplicate'),
    conflict: t('statement_preview_row_conflict'),
    error: t('statement_preview_row_error'),
  }[kind]);

  const summaryStats = [
    [t('statement_preview_new_transactions'), preview.newTransactions.length, 'text-emerald-300'],
    [t('statement_preview_matches'), preview.matches.length, 'text-cyan-300'],
    [t('statement_preview_duplicates'), preview.duplicates.length, 'text-amber-300'],
    [t('statement_preview_conflicts'), preview.conflicts.length, 'text-orange-300'],
    [t('statement_preview_errors'), preview.errors.length, 'text-rose-300'],
  ] as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
      onClick={() => { if (!isSubmitting) onClose(); }}
    >
      <div
        className="flex max-h-[96vh] w-full max-w-5xl flex-col rounded-t-[28px] border border-white/10 bg-slate-800 shadow-2xl sm:rounded-[28px]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-white/10 px-6 pt-6 pb-4 sm:px-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
            {t('import_statement_csv')}
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-50">{t('statement_preview_title')}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {t('statement_preview_description')
              .replace('{fileName}', preview.fileName)
              .replace('{total}', String(preview.totalRows))}
          </p>

          {/* Stats chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            {summaryStats.map(([label, count, color]) => (
              <span
                key={label}
                className="rounded-full border border-white/10 bg-slate-900/60 px-2.5 py-1 text-xs font-semibold text-slate-300"
              >
                <span className={`font-bold ${color}`}>{count}</span> {label}
              </span>
            ))}
          </div>
        </div>

        {/* Table toolbar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-6 py-2 sm:px-8">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer accent-[var(--app-primary)]"
              checked={allSelected}
              onChange={toggleAll}
            />
            {allSelected ? t('statement_preview_deselect_all') : t('statement_preview_select_all')}
          </label>
          <span className="ml-auto text-xs text-slate-500">
            {selectedCount} / {selectableKeys.length} {t('statement_preview_matches').toLowerCase()}
          </span>
        </div>

        {/* Scrollable table */}
        <div ref={tableContainerRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur-sm">
              <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="w-10 px-4 py-2.5" />
                <th className="px-3 py-2.5">{t('status')}</th>
                <th className="px-3 py-2.5">{t('date')}</th>
                <th className="min-w-[180px] px-3 py-2.5">{t('description')}</th>
                <th className="px-3 py-2.5 text-right">{t('amount')}</th>
                <th className="min-w-[150px] px-3 py-2.5">{t('category')}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(tr => {
                const state = rowStates[tr.key];
                if (!state) return null;
                return (
                  <tr
                    key={tr.key}
                    title={kindLabel(tr.kind)}
                    className={`border-b border-white/5 transition-colors last:border-0 ${rowBg(tr.kind)} ${!tr.canSelect ? 'pointer-events-none' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-[var(--app-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                        checked={state.selected}
                        disabled={!tr.canSelect}
                        onChange={e => setRowField(tr.key, 'selected', e.target.checked)}
                        aria-label={state.description}
                      />
                    </td>

                    {/* Status badge */}
                    <td className="px-3 py-2">
                      <KindBadge kind={tr.kind} label={kindLabel(tr.kind)} />
                    </td>

                    {/* Date */}
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                      {tr.kind === 'error' ? `L${tr.row.lineNumber}` : formatDate(tr.row.date)}
                    </td>

                    {/* Description (editable) */}
                    <td className="px-3 py-1.5">
                      {tr.kind === 'error' ? (
                        <span className="text-xs text-slate-500">{tr.row.description}</span>
                      ) : (
                        <input
                          type="text"
                          value={state.description}
                          onChange={e => setRowField(tr.key, 'description', e.target.value)}
                          disabled={!state.selected}
                          className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-sm text-slate-100 transition focus:border-[var(--app-primary)] focus:outline-none focus:ring-0 disabled:opacity-50"
                        />
                      )}
                    </td>

                    {/* Amount */}
                    <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${tr.row.type === TransactionType.INCOME ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {tr.kind === 'error' ? '—' : (
                        <>
                          {tr.row.type === TransactionType.INCOME ? '+' : '−'} {formatCurrency(tr.row.amount)}
                        </>
                      )}
                    </td>

                    {/* Category (editable) */}
                    <td className="px-3 py-1.5">
                      {tr.kind === 'error' ? null : (
                        <select
                          value={state.category}
                          onChange={e => setRowField(tr.key, 'category', e.target.value)}
                          disabled={!state.selected}
                          className="w-full rounded-lg border border-transparent bg-slate-900/60 px-1.5 py-1 text-sm text-slate-100 transition focus:border-[var(--app-primary)] focus:outline-none disabled:opacity-50"
                        >
                          {allCategoryKeys.map(key => (
                            <option key={key} value={key}>
                              {allCategoriesMap[key]?.name ?? key}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {tableRows.length === 0 && (
            <p className="px-6 py-10 text-center text-sm text-slate-500">
              {t('statement_preview_no_actions')}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/10 px-6 py-4 sm:px-8">
          <p className="mb-3 text-xs text-slate-500">{t('statement_preview_safety_note')}</p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              className="button-primary"
              disabled={isSubmitting || selectedCount === 0}
              onClick={handleConfirm}
            >
              {isSubmitting
                ? t('importing')
                : t('statement_preview_import_selected').replace('{count}', String(selectedCount))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatementImportPreviewModal;
