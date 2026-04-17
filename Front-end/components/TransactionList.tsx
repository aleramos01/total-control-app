import React, { useMemo, useRef, useState } from 'react';
import { Transaction, TransactionFilters } from '../types';
import { useLanguage } from '../LanguageContext';
import ConfirmationDialog from './ConfirmationDialog';
import { ExportIcon } from './icons/ExportIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import TransactionGroup from './TransactionGroup';

interface TransactionListProps {
  transactions: Transaction[];
  filters: TransactionFilters;
  onFiltersChange: React.Dispatch<React.SetStateAction<TransactionFilters>>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenCategoryModal: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
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
  onImportJson,
  allCategoriesMap,
}) => {
  const { t, formatCurrency, locale } = useLanguage();
  const [transactionToDelete, setTransactionToDelete] = React.useState<Transaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => Object.entries(allCategoriesMap), [allCategoriesMap]);
  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, Transaction[]>();

    [...transactions]
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .forEach(transaction => {
        const group = groups.get(transaction.category) ?? [];
        group.push(transaction);
        groups.set(transaction.category, group);
      });

    return [...groups.entries()].sort((left, right) => {
      const leftTotal = left[1].reduce((sum, transaction) => sum + transaction.amount, 0);
      const rightTotal = right[1].reduce((sum, transaction) => sum + transaction.amount, 0);
      return rightTotal - leftTotal;
    });
  }, [transactions]);
  const totalVisible = useMemo(() => transactions.reduce((sum, transaction) => sum + transaction.amount, 0), [transactions]);

  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-800/70 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.28)] backdrop-blur">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-50">{t('transaction_table_title')}</h2>
          <p className="text-sm text-slate-400">{t('transactions_overview')}</p>
          <p className="mt-2 text-2xl font-extrabold text-cyan-300">{formatCurrency(totalVisible)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100"
            onClick={() => setShowFilters(current => !current)}
          >
            {t('filters')}
            <ChevronDownIcon className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="button-secondary !rounded-full !px-3 !py-2" onClick={onOpenCategoryModal}>{t('categories')}</button>
            <button type="button" className="button-secondary !rounded-full !px-3 !py-2" onClick={onExportCsv}>
              <ExportIcon className="h-4 w-4" />
              {t('export_csv')}
            </button>
            <button type="button" className="button-secondary !rounded-full !px-3 !py-2" onClick={onExportJson}>{t('export_json')}</button>
            <button type="button" className="button-secondary !rounded-full !px-3 !py-2" onClick={() => importRef.current?.click()}>{t('import_json')}</button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) {
                onImportJson(file);
              }
              event.target.value = '';
            }}
          />
        </div>
      </div>

      {showFilters ? (
        <div className="mb-5 grid gap-3 rounded-[24px] border border-white/10 bg-slate-900/55 p-4 md:grid-cols-2 xl:grid-cols-5">
          <input
            value={filters.q ?? ''}
            onChange={event => onFiltersChange(current => ({ ...current, q: event.target.value || undefined }))}
            placeholder={t('search_placeholder')}
            className="input-base xl:col-span-2"
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
          <button type="button" className="button-secondary justify-center md:col-span-2 xl:col-span-5" onClick={() => onFiltersChange({})}>
            {t('clear_filters')}
          </button>
        </div>
      ) : null}

      {transactions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 px-4 py-8 text-center text-slate-400">
          {t('no_transactions')}
        </div>
      ) : (
        <div className="space-y-3">
          {groupedTransactions.map(([categoryKey, grouped]) => (
            <TransactionGroup
              key={categoryKey}
              categoryKey={categoryKey}
              transactions={grouped}
              onEdit={onEdit}
              onDelete={(id) => {
                const transaction = transactions.find(item => item.id === id);
                if (transaction) {
                  setTransactionToDelete(transaction);
                }
              }}
              allCategoriesMap={allCategoriesMap}
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
    </section>
  );
};

export default TransactionList;
