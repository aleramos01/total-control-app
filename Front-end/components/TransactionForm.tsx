import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, CustomCategory } from '../types';
import { useLanguage } from '../LanguageContext';
import { extractDateInputValue, suggestCategoryFromDescription, toStoredDate } from '../lib/transactions';

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id'> & { id?: string }) => void;
  transaction: Transaction | null;
  allCategoriesMap: { [key: string]: { name: string } };
  allCategoryKeys: string[];
  customCategories: CustomCategory[];
}

const TransactionForm: React.FC<TransactionFormProps> = ({
  isOpen, onClose, onSave, transaction, allCategoriesMap, allCategoryKeys,
}) => {
  const { t } = useLanguage();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [category, setCategory] = useState<string>('other');
  const [isRecurring, setIsRecurring] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [notes, setNotes] = useState('');
  const [isCategoryManuallySet, setIsCategoryManuallySet] = useState(false);

  useEffect(() => {
    if (transaction) {
      setDescription(transaction.description);
      setAmount(String(transaction.amount));
      setDate(extractDateInputValue(transaction.date));
      setType(transaction.type);
      setCategory(transaction.category);
      setIsRecurring(!!transaction.isRecurring);
      setDueDate(extractDateInputValue(transaction.dueDate));
      setIsPaid(!!transaction.isPaid);
      setNotes(transaction.notes ?? '');
      setIsCategoryManuallySet(true);
    } else {
      setDescription('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setType(TransactionType.EXPENSE);
      setCategory('other');
      setIsRecurring(false);
      setDueDate('');
      setIsPaid(false);
      setNotes('');
      setIsCategoryManuallySet(false);
    }
  }, [transaction, isOpen]);

  useEffect(() => {
    if (isCategoryManuallySet) {
      return;
    }

    setCategory(suggestCategoryFromDescription(description, type, allCategoriesMap, allCategoryKeys));
  }, [allCategoriesMap, allCategoryKeys, description, isCategoryManuallySet, type]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!description || !amount) {
      return;
    }

    onSave({
      id: transaction?.id,
      description,
      amount: parseFloat(amount),
      date: toStoredDate(date),
      type,
      category,
      isRecurring: type === TransactionType.EXPENSE && isRecurring,
      dueDate: type === TransactionType.EXPENSE && dueDate ? toStoredDate(dueDate) : undefined,
      isPaid: type === TransactionType.EXPENSE ? isPaid : true,
      notes,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-slate-800 p-8 text-slate-100 shadow-2xl">
        <h2 className="mb-6 text-2xl font-bold text-slate-50">{transaction ? t('edit_transaction') : t('create_transaction')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="description" className="mb-2 block text-sm font-medium text-slate-300">{t('description')}</label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="input-base"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="amount" className="mb-2 block text-sm font-medium text-slate-300">{t('amount')}</label>
              <input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="input-base"
                required
              />
            </div>
            <div>
              <label htmlFor="date" className="mb-2 block text-sm font-medium text-slate-300">{t('date')}</label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="input-base"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">{t('type')}</label>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-900 p-1">
              <button type="button" onClick={() => setType(TransactionType.INCOME)} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${type === TransactionType.INCOME ? 'bg-slate-700 text-slate-50' : 'text-slate-400'}`}>{t('income')}</button>
              <button type="button" onClick={() => setType(TransactionType.EXPENSE)} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${type === TransactionType.EXPENSE ? 'bg-slate-700 text-slate-50' : 'text-slate-400'}`}>{t('expenses')}</button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="category" className="mb-2 block text-sm font-medium text-slate-300">{t('category')}</label>
              <select
                id="category"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setIsCategoryManuallySet(true);
                }}
                className="input-base"
              >
                {allCategoryKeys.map(catKey => (
                  <option key={catKey} value={catKey}>
                    {allCategoriesMap[catKey].name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="mb-2 block text-sm font-medium text-slate-300">{t('notes')}</label>
              <input
                id="notes"
                type="text"
                value={notes}
                onChange={event => setNotes(event.target.value)}
                className="input-base"
                placeholder={t('notes_placeholder')}
              />
            </div>
          </div>

          {type === TransactionType.EXPENSE && (
            <div className="space-y-4 rounded-[24px] border border-white/10 bg-slate-900/60 p-5">
              <label className="flex items-center gap-3 text-sm font-medium text-slate-300">
                <input type="checkbox" checked={isRecurring} onChange={event => setIsRecurring(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                {t('this_is_recurring')}
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="dueDate" className="mb-2 block text-sm font-medium text-slate-300">{t('due_date')}</label>
                  <input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="input-base"
                    required={isRecurring}
                  />
                </div>
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-300">
                  <input type="checkbox" checked={isPaid} onChange={event => setIsPaid(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  {t('paid')}
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} className="button-secondary">{t('cancel')}</button>
            <button type="submit" className="button-primary">{t('save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;
