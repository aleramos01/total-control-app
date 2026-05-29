import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType } from '../types';
import TransactionItem from './TransactionItem';
import { useLanguage } from '../LanguageContext';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

const INITIAL_VISIBLE_TRANSACTIONS = 75;
const VISIBLE_TRANSACTIONS_STEP = 75;

interface TransactionGroupProps {
  title: string;
  transactions: Transaction[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  allCategoriesMap: { [key: string]: { name: string; color: string } };
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

const TransactionGroup: React.FC<TransactionGroupProps> = ({
  title,
  transactions,
  onEdit,
  onDelete,
  allCategoriesMap,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_TRANSACTIONS);
  const { t, formatCurrency } = useLanguage();
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);
  const visibleTransactions = sortedTransactions.slice(0, visibleCount);
  const hiddenCount = Math.max(sortedTransactions.length - visibleTransactions.length, 0);

  if (transactions.length === 0) {
    return null;
  }

  const totalIncome = transactions
    .filter(tx => tx.type === TransactionType.INCOME)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = transactions
    .filter(tx => tx.type === TransactionType.EXPENSE)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const balance = totalIncome - totalExpense;
  const amountColor = balance >= 0 ? 'text-cyan-300' : 'text-amber-300';

  const transactionCountText = transactions.length === 1 
    ? t('transaction_count_one').replace('{count}', '1')
    : t('transaction_count_other').replace('{count}', String(transactions.length));

  return (
    <div className="overflow-hidden rounded-[22px] border border-white/10 bg-slate-800/70 shadow-[0_18px_45px_rgba(15,23,42,0.28)]">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-slate-800/90"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-2 rounded bg-[var(--app-primary)]"></div>
          <div>
            <p className="text-lg font-bold text-slate-100">{title}</p>
            <p className="text-sm text-slate-400">{transactionCountText}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <p className={`font-bold text-lg ${amountColor}`}>
            {formatCurrency(balance)}
          </p>
          <ChevronDownIcon className={`w-6 h-6 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      
      {isOpen && (
        <div className="px-4 pb-2 space-y-2">
          {visibleTransactions.map(transaction => (
            <TransactionItem
              key={transaction.id}
              transaction={transaction}
              onEdit={onEdit}
              onDelete={onDelete}
              allCategoriesMap={allCategoriesMap}
              isGrouped={true}
              selectionMode={selectionMode}
              isSelected={selectedIds?.has(transaction.id) ?? false}
              onToggleSelect={onToggleSelect}
            />
          ))}
          {hiddenCount > 0 ? (
            <button
              type="button"
              className="button-secondary my-3 w-full justify-center"
              onClick={() => setVisibleCount(current => current + VISIBLE_TRANSACTIONS_STEP)}
            >
              {t('load_more_transactions').replace('{count}', String(Math.min(hiddenCount, VISIBLE_TRANSACTIONS_STEP)))}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default TransactionGroup;
