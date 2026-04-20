import React from 'react';
import { Transaction, TransactionType } from '../types';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ArrowUpIcon } from './icons/ArrowUpIcon';
import { ArrowDownIcon } from './icons/ArrowDownIcon';
import { useLanguage } from '../LanguageContext';


interface TransactionItemProps {
  transaction: Transaction;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  allCategoriesMap: { [key: string]: { name: string } };
  isGrouped?: boolean;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, onEdit, onDelete, allCategoriesMap, isGrouped = false }) => {
  const { locale, t, formatCurrency } = useLanguage();

  const isIncome = transaction.type === TransactionType.INCOME;
  const amountColor = isIncome ? 'text-green-400' : 'text-red-400';
  const Icon = isIncome ? ArrowUpIcon : ArrowDownIcon;
  const iconBgColor = isIncome ? 'bg-green-500/10' : 'bg-red-500/10';

  const formattedAmount = formatCurrency(transaction.amount);
  const formattedDate = new Date(transaction.date).toLocaleDateString(locale);
  const categoryName = allCategoriesMap[transaction.category]?.name || transaction.category;
  const installmentLabel = transaction.installmentCount && transaction.installmentIndex
    ? t('installment_label')
      .replace('{current}', String(transaction.installmentIndex))
      .replace('{total}', String(transaction.installmentCount))
    : null;

  const baseClasses = "group flex items-center space-x-4 transition-all";
  const standaloneClasses = "rounded-2xl border border-white/10 bg-slate-800/70 p-4 hover:border-[var(--app-primary)] hover:bg-slate-800";
  const groupedClasses = "rounded-xl bg-slate-900/70 p-3";

  return (
    <div className={`${baseClasses} ${isGrouped ? groupedClasses : standaloneClasses}`}>
      <div className={`p-3 rounded-full ${iconBgColor}`}>
        <Icon className={`h-5 w-5 ${amountColor}`} />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-slate-200">{transaction.description}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <span>{isGrouped ? `${categoryName} - ${formattedDate}` : `${categoryName} - ${formattedDate}`}</span>
          {installmentLabel ? (
            <span className="rounded-full border border-white/10 bg-slate-950/50 px-2 py-0.5 text-xs text-slate-300">
              {installmentLabel}
            </span>
          ) : null}
        </div>
      </div>
      <div className="text-right">
        <p className={`font-bold text-lg ${amountColor}`}>{isIncome ? `+ ${formattedAmount}` : `- ${formattedAmount}`}</p>
      </div>
      <div className="flex items-center space-x-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <button onClick={() => onEdit(transaction.id)} className="p-2 text-slate-400 hover:text-cyan-400" aria-label={t('edit_aria')}>
          <PencilIcon className="h-5 w-5" />
        </button>
        <button onClick={() => onDelete(transaction.id)} className="p-2 text-slate-400 hover:text-red-400" aria-label={t('delete_aria')}>
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default TransactionItem;
