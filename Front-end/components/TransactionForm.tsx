import React, { useEffect, useMemo, useState } from 'react';
import { Transaction, TransactionType, CustomCategory } from '../types';
import { useLanguage } from '../LanguageContext';
import { extractDateInputValue, suggestCategoryFromDescription, toStoredDate } from '../lib/transactions';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { XCircleIcon } from './icons/XCircleIcon';

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
  const { t, locale } = useLanguage();
  const scheduleLabels = {
    once: t('schedule_once'),
    recurring: t('schedule_recurring'),
    installment: t('schedule_installment'),
  };
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [category, setCategory] = useState<string>('other');
  const [scheduleType, setScheduleType] = useState<'once' | 'recurring' | 'installment'>('once');
  const [installmentCount, setInstallmentCount] = useState(2);
  const [isRecurring, setIsRecurring] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [notes, setNotes] = useState('');
  const [isCategoryManuallySet, setIsCategoryManuallySet] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  useEffect(() => {
    if (transaction) {
      const resolvedScheduleType = transaction.scheduleType ?? (transaction.installmentCount && transaction.installmentCount > 1 ? 'installment' : transaction.isRecurring ? 'recurring' : 'once');
      setDescription(transaction.description);
      setAmount(String(transaction.amount));
      setDate(extractDateInputValue(transaction.date));
      setType(transaction.type);
      setCategory(transaction.category);
      setScheduleType(resolvedScheduleType);
      setInstallmentCount(transaction.installmentCount ?? 2);
      setIsRecurring(!!transaction.isRecurring);
      setDueDate(extractDateInputValue(transaction.dueDate ?? undefined));
      setIsPaid(!!transaction.isPaid);
      setNotes(transaction.notes ?? '');
      setIsCategoryManuallySet(true);
      setIsAdvancedOpen(
        !!transaction.notes || (
          transaction.type === TransactionType.EXPENSE && (
          resolvedScheduleType !== 'once'
          || !!transaction.dueDate
          || !!transaction.isPaid
        )
        )
      );
      return;
    }

    setDescription('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setType(TransactionType.EXPENSE);
    setCategory('other');
    setScheduleType('once');
    setInstallmentCount(2);
    setIsRecurring(false);
    setDueDate('');
    setIsPaid(false);
    setNotes('');
    setIsCategoryManuallySet(false);
    setIsAdvancedOpen(false);
  }, [transaction, isOpen]);

  useEffect(() => {
    if (isCategoryManuallySet) {
      return;
    }

    setCategory(suggestCategoryFromDescription(description, type, allCategoriesMap, allCategoryKeys));
  }, [allCategoriesMap, allCategoryKeys, description, isCategoryManuallySet, type]);

  useEffect(() => {
    if (type === TransactionType.INCOME) {
      setScheduleType('once');
      setInstallmentCount(2);
      setIsRecurring(false);
      setDueDate('');
      setIsPaid(true);
      return;
    }

    if (!transaction || transaction.type !== TransactionType.EXPENSE) {
      setIsPaid(false);
    }
  }, [transaction, type]);

  useEffect(() => {
    if (type !== TransactionType.EXPENSE) {
      return;
    }

    if (scheduleType === 'installment') {
      setIsRecurring(false);
      setIsPaid(false);
      setDueDate('');
      return;
    }

    if (scheduleType === 'recurring') {
      setIsRecurring(true);
      return;
    }

    setIsRecurring(false);
    setInstallmentCount(2);
    setDueDate('');
    setIsPaid(false);
  }, [scheduleType, type]);

  const resolvedCategoryName = allCategoriesMap[category]?.name ?? t('category');
  const summarySchedule = useMemo(() => {
    if (type !== TransactionType.EXPENSE) {
      return null;
    }

    if (scheduleType === 'installment') {
      return t('schedule_installment');
    }

    if (scheduleType === 'recurring') {
      return t('schedule_recurring');
    }

    return null;
  }, [scheduleType, t, type]);

  const parsedAmount = Number(amount);
  const amountPreview = Number.isFinite(parsedAmount) && amount !== ''
    ? parsedAmount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Number(0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      scheduleType: type === TransactionType.EXPENSE ? scheduleType : 'once',
      installmentCount: type === TransactionType.EXPENSE && scheduleType === 'installment' ? installmentCount : 1,
      isRecurring: type === TransactionType.EXPENSE && scheduleType === 'recurring',
      dueDate: type === TransactionType.EXPENSE && scheduleType === 'recurring' && dueDate ? toStoredDate(dueDate) : undefined,
      isPaid: type === TransactionType.EXPENSE ? isPaid : true,
      notes,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/72 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label={t('close')} onClick={onClose} />
      <aside className="absolute inset-x-0 bottom-0 h-[92vh] rounded-t-[32px] border border-white/10 bg-slate-800 text-slate-100 shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-[540px] sm:rounded-none sm:border-l sm:border-t-0">
        <div className="flex h-full flex-col">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-800/95 px-4 py-4 backdrop-blur sm:px-6">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-600 sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t('transactions')}</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-50">{transaction ? t('edit_transaction') : t('create_transaction')}</h2>
              </div>
              <button type="button" onClick={onClose} className="rounded-full border border-white/10 p-2 text-slate-400 transition hover:text-slate-100" aria-label={t('close')}>
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
            <div className="sticky top-0 z-10 mb-4 rounded-[24px] border border-white/10 bg-slate-900/95 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.34)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('type')}</p>
                  <p className="mt-1 text-base font-semibold text-slate-50">{type === TransactionType.INCOME ? t('income') : t('expenses')}</p>
                </div>
                {summarySchedule ? (
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                    {summarySchedule}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('amount')}</p>
                  <p className={`mt-1 text-3xl font-bold ${type === TransactionType.INCOME ? 'text-emerald-300' : 'text-rose-200'}`}>
                    {type === TransactionType.INCOME ? '+' : '-'} {amountPreview}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('category')}</p>
                  <p className="mt-1 text-sm font-medium text-slate-200">{resolvedCategoryName}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <section className="rounded-[24px] border border-white/10 bg-slate-900/60 p-4">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('type')}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-950/70 p-1">
                    <button
                      type="button"
                      onClick={() => setType(TransactionType.EXPENSE)}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${type === TransactionType.EXPENSE ? 'bg-rose-500/20 text-rose-100' : 'text-slate-400'}`}
                    >
                      {t('expenses')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setType(TransactionType.INCOME)}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${type === TransactionType.INCOME ? 'bg-emerald-500/20 text-emerald-100' : 'text-slate-400'}`}
                    >
                      {t('income')}
                    </button>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div>
                    <label htmlFor="amount" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('amount')}</label>
                    <input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className="input-base text-2xl font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('description')}</label>
                    <input
                      id="description"
                      type="text"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      className="input-base"
                      required
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-white/10 bg-slate-900/60 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="category" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('category')}</label>
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
                    <label htmlFor="date" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('date')}</label>
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
              </section>

              <section className="rounded-[24px] border border-white/10 bg-slate-900/60">
                <button
                  type="button"
                  onClick={() => setIsAdvancedOpen(previous => !previous)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('advanced_options')}</p>
                    <p className="mt-1 text-sm text-slate-300">{summarySchedule ?? t('notes')}</p>
                  </div>
                  <ChevronDownIcon className={`h-5 w-5 text-slate-400 transition ${isAdvancedOpen ? 'rotate-180' : ''}`} />
                </button>

                {isAdvancedOpen ? (
                  <div className="space-y-4 border-t border-white/10 px-4 pb-4 pt-4">
                    {type === TransactionType.EXPENSE ? (
                      <>
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('schedule_type')}</label>
                        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-950/70 p-1">
                          {(['once', 'installment', 'recurring'] as const).map(option => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setScheduleType(option)}
                              className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                                scheduleType === option ? 'bg-slate-700 text-slate-50' : 'text-slate-400'
                              }`}
                            >
                              {scheduleLabels[option]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {scheduleType === 'installment' ? (
                        <div>
                          <label htmlFor="installment-count" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('installment_count')}</label>
                          <input
                            id="installment-count"
                            type="number"
                            min={2}
                            max={36}
                            value={installmentCount}
                            onChange={event => setInstallmentCount(Math.max(2, Number(event.target.value || 2)))}
                            className="input-base"
                          />
                        </div>
                      ) : null}

                      {scheduleType === 'recurring' ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label htmlFor="dueDate" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('due_date')}</label>
                            <input
                              id="dueDate"
                              type="date"
                              value={dueDate}
                              onChange={(event) => setDueDate(event.target.value)}
                              className="input-base"
                              required
                            />
                          </div>
                          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-300">
                            <input type="checkbox" checked={isPaid} onChange={event => setIsPaid(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                            {t('paid')}
                          </label>
                        </div>
                      ) : null}
                      </>
                    ) : null}

                    <div>
                      <label htmlFor="notes" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('notes')}</label>
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
                ) : null}
              </section>

              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-white/10 bg-slate-800/95 px-1 pb-1 pt-4 backdrop-blur">
                <button type="button" onClick={onClose} className="button-secondary">{t('cancel')}</button>
                <button type="submit" className="button-primary">{transaction ? t('save_changes') : t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default TransactionForm;
