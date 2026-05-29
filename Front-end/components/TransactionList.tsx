import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Transaction, TransactionFilters } from '../types';
import { useLanguage } from '../LanguageContext';
import ConfirmationDialog from './ConfirmationDialog';
import { ExportIcon } from './icons/ExportIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { CheckIcon } from './icons/CheckIcon';
import { TrashIcon } from './icons/TrashIcon';
import TransactionGroup from './TransactionGroup';
import StatePanel from './StatePanel';
import { extractDateInputValue, formatDatePtBr, formatMonthGroupLabel, hasActiveTransactionFilters, toStoredDate, toStoredDateEnd } from '../lib/transactions';

interface TransactionListProps {
  transactions: Transaction[];
  filters: TransactionFilters;
  onFiltersChange: React.Dispatch<React.SetStateAction<TransactionFilters>>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenCategoryModal: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onExportPdf: () => void;
  onImportJson: (file: File) => void;
  onImportStatementCsv: (file: File) => void;
  onImportStatementOfx: (file: File) => void;
  onResetFilters: () => void;
  onDeleteMany: (ids: string[]) => void;
  onTogglePaidMany: (ids: string[], isPaid: boolean) => void;
  allCategoriesMap: { [key: string]: { name: string; color: string } };
}

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  filters,
  onFiltersChange,
  onEdit,
  onDelete,
  onOpenCategoryModal,
  onExportCsv,
  onExportJson,
  onExportPdf,
  onImportJson,
  onImportStatementCsv,
  onImportStatementOfx,
  onResetFilters,
  onDeleteMany,
  onTogglePaidMany,
  allCategoriesMap,
}) => {
  const { t, formatCurrency, locale } = useLanguage();
  const [transactionToDelete, setTransactionToDelete] = React.useState<Transaction | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteMany, setConfirmDeleteMany] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [draftFrom, setDraftFrom] = useState(extractDateInputValue(filters.from));
  const [draftTo, setDraftTo] = useState(extractDateInputValue(filters.to));
  const importRef = useRef<HTMLInputElement>(null);
  const statementImportRef = useRef<HTMLInputElement>(null);
  const ofxImportRef = useRef<HTMLInputElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showImportMenu && !showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (showImportMenu && importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) setShowImportMenu(false);
      if (showExportMenu && exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showImportMenu, showExportMenu]);

  const categories = useMemo(() => Object.entries(allCategoriesMap), [allCategoriesMap]);
  const hasActiveFilters = useMemo(() => hasActiveTransactionFilters(filters), [filters]);
  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, Transaction[]>();

    [...transactions]
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .forEach(transaction => {
        const groupKey = transaction.date.slice(0, 7);
        const group = groups.get(groupKey) ?? [];
        group.push(transaction);
        groups.set(groupKey, group);
      });

    return [...groups.entries()].sort((left, right) => {
      return right[0].localeCompare(left[0]);
    });
  }, [transactions]);
  const totalVisible = useMemo(() => transactions.reduce((sum, transaction) => sum + transaction.amount, 0), [transactions]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedTransactions = useMemo(
    () => transactions.filter(transaction => selectedIdSet.has(transaction.id)),
    [selectedIdSet, transactions],
  );
  const selectedExpenseIds = useMemo(
    () => selectedTransactions.filter(transaction => transaction.type === 'expense').map(transaction => transaction.id),
    [selectedTransactions],
  );
  const hasMixedSelection = useMemo(
    () => selectedTransactions.some(transaction => transaction.type !== 'expense'),
    [selectedTransactions],
  );
  const periodPresets: Array<{ id: NonNullable<TransactionFilters['preset']>; label: string }> = [
    { id: 'current_month', label: t('current_month') },
    { id: 'previous_month', label: t('previous_month') },
    { id: 'next_30_days', label: t('next_30_days') },
    { id: 'overdue', label: t('overdue') },
  ];
  const activeFilterBadges = useMemo(() => {
    const badges: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (filters.q) {
      badges.push({
        key: 'q',
        label: `${t('search')}: ${filters.q}`,
        onRemove: () => onFiltersChange(current => ({ ...current, q: undefined })),
      });
    }

    if (filters.type) {
      badges.push({
        key: 'type',
        label: `${t('type')}: ${filters.type === 'income' ? t('income') : t('expenses')}`,
        onRemove: () => onFiltersChange(current => ({ ...current, type: '' })),
      });
    }

    if (filters.category) {
      badges.push({
        key: 'category',
        label: `${t('category')}: ${allCategoriesMap[filters.category]?.name ?? filters.category}`,
        onRemove: () => onFiltersChange(current => ({ ...current, category: undefined })),
      });
    }

    if (filters.status) {
      badges.push({
        key: 'status',
        label: `${t('status')}: ${filters.status === 'paid' ? t('paid') : t('unpaid')}`,
        onRemove: () => onFiltersChange(current => ({ ...current, status: '' })),
      });
    }

    if (filters.preset && filters.preset !== 'current_month') {
      const preset = periodPresets.find(item => item.id === filters.preset);
      if (preset) {
        badges.push({
          key: 'preset',
          label: `${t('period_presets')}: ${preset.label}`,
          onRemove: () => onFiltersChange(current => ({ ...current, preset: '' })),
        });
      }
    }

    if (filters.from) {
      badges.push({
        key: 'from',
        label: `${t('from')}: ${formatDatePtBr(filters.from)}`,
        onRemove: () => {
          setDraftFrom('');
          onFiltersChange(current => ({ ...current, from: undefined }));
        },
      });
    }

    if (filters.to) {
      badges.push({
        key: 'to',
        label: `${t('to')}: ${formatDatePtBr(filters.to)}`,
        onRemove: () => {
          setDraftTo('');
          onFiltersChange(current => ({ ...current, to: undefined }));
        },
      });
    }

    return badges;
  }, [allCategoriesMap, filters, onFiltersChange, periodPresets, t]);

  const syncDraftDates = (nextFilters: TransactionFilters) => {
    setDraftFrom(extractDateInputValue(nextFilters.from));
    setDraftTo(extractDateInputValue(nextFilters.to));
  };

  const resetSelection = () => {
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  const applyDateRange = () => {
    onFiltersChange(current => ({
      ...current,
      from: draftFrom ? toStoredDate(draftFrom) : undefined,
      to: draftTo ? toStoredDateEnd(draftTo) : undefined,
      preset: draftFrom || draftTo ? '' : current.preset,
    }));
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const selectAllVisible = () => {
    setSelectedIds(transactions.map(transaction => transaction.id));
  };

  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-800/70 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.28)] backdrop-blur">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-50">{t('transaction_table_title')}</h2>
          <p className="text-sm text-slate-400">{t('transactions_overview')}</p>
          <p className="mt-2 text-2xl font-extrabold text-cyan-300">{formatCurrency(totalVisible)}</p>
        </div>
        {/* ── Compact toolbar ── */}
        <div className="flex flex-wrap items-center justify-end gap-2">

          {/* Select toggle */}
          <button
            type="button"
            className={`button-secondary !rounded-full !px-3 !py-2 ${isSelectionMode ? '!border-cyan-400/40 !bg-cyan-500/10 !text-cyan-100' : ''}`}
            onClick={() => isSelectionMode ? resetSelection() : setIsSelectionMode(true)}
          >
            {isSelectionMode ? t('cancel_selection') : t('select_transactions')}
          </button>

          {/* Categories */}
          <button type="button" className="button-secondary !rounded-full !px-3 !py-2" onClick={onOpenCategoryModal}>
            {t('categories')}
          </button>

          {/* Import dropdown */}
          <div ref={importMenuRef} className="relative">
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/20 ${showImportMenu ? 'border-white/20' : ''}`}
              onClick={() => { setShowImportMenu(v => !v); setShowExportMenu(false); }}
            >
              Importar
              <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showImportMenu ? 'rotate-180' : ''}`} />
            </button>
            {showImportMenu && (
              <div className="absolute right-0 top-full z-20 mt-1.5 min-w-[180px] rounded-2xl border border-white/10 bg-slate-900 py-1.5 shadow-xl">
                <button type="button" className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800" onClick={() => { statementImportRef.current?.click(); setShowImportMenu(false); }}>
                  Extrato CSV
                </button>
                <button type="button" className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800" onClick={() => { ofxImportRef.current?.click(); setShowImportMenu(false); }}>
                  Extrato OFX / QFX
                </button>
                <div className="my-1 border-t border-white/10" />
                <button type="button" className="w-full px-4 py-2.5 text-left text-sm text-slate-400 hover:bg-slate-800" onClick={() => { importRef.current?.click(); setShowImportMenu(false); }}>
                  Backup JSON
                </button>
              </div>
            )}
          </div>

          {/* Export dropdown */}
          <div ref={exportMenuRef} className="relative">
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/20 ${showExportMenu ? 'border-white/20' : ''}`}
              onClick={() => { setShowExportMenu(v => !v); setShowImportMenu(false); }}
            >
              <ExportIcon className="h-3.5 w-3.5" />
              Exportar
              <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full z-20 mt-1.5 min-w-[160px] rounded-2xl border border-white/10 bg-slate-900 py-1.5 shadow-xl">
                <button type="button" className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800" onClick={() => { onExportPdf(); setShowExportMenu(false); }}>
                  PDF
                </button>
                <button type="button" className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800" onClick={() => { onExportCsv(); setShowExportMenu(false); }}>
                  CSV
                </button>
                <button type="button" className="w-full px-4 py-2.5 text-left text-sm text-slate-400 hover:bg-slate-800" onClick={() => { onExportJson(); setShowExportMenu(false); }}>
                  JSON (backup)
                </button>
              </div>
            )}
          </div>

          {/* Filters */}
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition ${
              hasActiveFilters
                ? 'border-[var(--app-primary)]/60 bg-[var(--app-primary)]/10 text-slate-100'
                : 'border-white/10 bg-slate-900/70 text-slate-100 hover:border-white/20'
            }`}
            onClick={() => setShowFilters(v => !v)}
          >
            {t('filters')}
            {hasActiveFilters && <span className="flex h-1.5 w-1.5 rounded-full bg-[var(--app-primary)]" />}
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Hidden file inputs */}
          <input ref={importRef} type="file" accept="application/json" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onImportJson(f); e.target.value = ''; }} />
          <input ref={statementImportRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onImportStatementCsv(f); e.target.value = ''; }} />
          <input ref={ofxImportRef} type="file" accept=".ofx,.qfx,application/x-ofx" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onImportStatementOfx(f); e.target.value = ''; }} />
        </div>
      </div>

      {hasActiveFilters ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {activeFilterBadges.map(badge => (
            <button
              key={badge.key}
              type="button"
              onClick={badge.onRemove}
              className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-[var(--app-primary)]"
            >
              {badge.label} ×
            </button>
          ))}
        </div>
      ) : null}

      {showFilters ? (
        <div className="mb-5 grid gap-3 rounded-[24px] border border-white/10 bg-slate-900/55 p-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="md:col-span-2 xl:col-span-5">
            <p className="mb-2 text-sm font-medium text-slate-300">{t('period_presets')}</p>
            <div className="flex flex-wrap gap-2">
              {periodPresets.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                    filters.preset === preset.id
                      ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/15 text-slate-50'
                      : 'border-white/10 bg-slate-950/50 text-slate-400'
                  }`}
                  onClick={() => {
                    const nextPreset = filters.preset === preset.id ? '' : preset.id;
                    syncDraftDates({ preset: nextPreset });
                    onFiltersChange(current => ({
                      ...current,
                      preset: nextPreset,
                      from: undefined,
                      to: undefined,
                    }));
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-300">{t('from')}</span>
            <input
              type="date"
              lang="pt-BR"
              value={draftFrom}
              onChange={event => setDraftFrom(event.target.value)}
              className="input-base"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-300">{t('to')}</span>
            <input
              type="date"
              lang="pt-BR"
              value={draftTo}
              onChange={event => setDraftTo(event.target.value)}
              onBlur={applyDateRange}
              className="input-base"
            />
          </label>
          <input
            value={filters.q ?? ''}
            onChange={event => onFiltersChange(current => ({ ...current, q: event.target.value || undefined }))}
            placeholder={t('search_placeholder')}
            className="input-base md:col-span-2 xl:col-span-3"
          />
          <select value={filters.type ?? ''} onChange={event => onFiltersChange(current => ({ ...current, type: (event.target.value || '') as TransactionFilters['type'] }))} className="input-base">
            <option value="">{t('type')}</option>
            <option value="income">{t('income')}</option>
            <option value="expense">{t('expenses')}</option>
          </select>
          <select value={filters.category ?? ''} onChange={event => onFiltersChange(current => ({ ...current, category: event.target.value || undefined }))} className="input-base">
            <option value="">{t('category')}</option>
            {categories.map(([key, value]) => (
              <option key={key} value={key}>{value.name}</option>
            ))}
          </select>
          <select value={filters.status ?? ''} onChange={event => onFiltersChange(current => ({ ...current, status: (event.target.value || '') as TransactionFilters['status'] }))} className="input-base">
            <option value="">{t('status')}</option>
            <option value="paid">{t('paid')}</option>
            <option value="unpaid">{t('unpaid')}</option>
          </select>
          <button type="button" className="button-secondary justify-center md:col-span-2 xl:col-span-5" onClick={() => {
            syncDraftDates({ preset: 'current_month' });
            onFiltersChange({ preset: 'current_month' });
          }}>
            {t('clear_filters')}
          </button>
        </div>
      ) : null}

      {isSelectionMode ? (
        <div className="mb-5 rounded-[24px] border border-cyan-400/20 bg-cyan-500/8 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-100">
                {t('selected_transactions_count').replace('{count}', String(selectedIds.length))}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {hasMixedSelection ? t('bulk_paid_only_for_expenses') : t('bulk_actions_helper')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="button-secondary !rounded-full !px-3 !py-2" onClick={selectAllVisible}>
                {t('select_all_visible')}
              </button>
              <button
                type="button"
                className="button-secondary !rounded-full !px-3 !py-2"
                disabled={selectedExpenseIds.length === 0 || hasMixedSelection}
                onClick={() => onTogglePaidMany(selectedExpenseIds, true)}
              >
                <CheckIcon className="h-4 w-4" />
                {t('mark_selected_paid')}
              </button>
              <button
                type="button"
                className="button-secondary !rounded-full !px-3 !py-2"
                disabled={selectedExpenseIds.length === 0 || hasMixedSelection}
                onClick={() => onTogglePaidMany(selectedExpenseIds, false)}
              >
                {t('mark_selected_unpaid')}
              </button>
              <button
                type="button"
                className="button-secondary !rounded-full !px-3 !py-2 !text-rose-200"
                disabled={selectedIds.length === 0}
                onClick={() => setConfirmDeleteMany(true)}
              >
                <TrashIcon className="h-4 w-4" />
                {t('delete_selected')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {transactions.length === 0 ? (
        <StatePanel
          title={hasActiveFilters ? t('no_transactions_filtered') : t('no_transactions_yet')}
          description={hasActiveFilters ? t('no_transactions_filtered_helper') : t('no_transactions_yet_helper')}
          actionLabel={hasActiveFilters ? t('clear_filters') : undefined}
          onAction={hasActiveFilters ? onResetFilters : undefined}
        />
      ) : (
        <div className="space-y-3">
          {groupedTransactions.map(([monthKey, grouped]) => (
            <TransactionGroup
              key={monthKey}
              title={formatMonthGroupLabel(monthKey, locale)}
              transactions={grouped}
              onEdit={onEdit}
              onDelete={(id) => {
                const transaction = transactions.find(item => item.id === id);
                if (transaction) {
                  setTransactionToDelete(transaction);
                }
              }}
              allCategoriesMap={allCategoriesMap}
              selectionMode={isSelectionMode}
              selectedIds={selectedIdSet}
              onToggleSelect={toggleSelection}
            />
          ))}
          <p className="px-2 text-xs uppercase tracking-[0.16em] text-slate-500">
            {locale === 'pt-BR' ? `${transactions.length} itens filtrados` : `${transactions.length} filtered items`}
          </p>
        </div>
      )}

      {transactionToDelete && (
        <ConfirmationDialog
          isOpen={!!transactionToDelete}
          onClose={() => setTransactionToDelete(null)}
          onConfirm={() => {
            onDelete(transactionToDelete.id);
            setTransactionToDelete(null);
          }}
          title={t('confirm_delete_title')}
          message={t('confirm_delete_message').replace('{description}', transactionToDelete.description)}
          confirmButtonText={t('delete')}
          confirmButtonVariant="danger"
        />
      )}

      {confirmDeleteMany ? (
        <ConfirmationDialog
          isOpen={confirmDeleteMany}
          onClose={() => setConfirmDeleteMany(false)}
          onConfirm={() => {
            onDeleteMany(selectedIds);
            setConfirmDeleteMany(false);
            resetSelection();
          }}
          title={t('confirm_delete_many_title')}
          message={t('confirm_delete_many_message').replace('{count}', String(selectedIds.length))}
          confirmButtonText={t('delete_selected')}
          confirmButtonVariant="danger"
        />
      ) : null}
    </section>
  );
};

export default TransactionList;
