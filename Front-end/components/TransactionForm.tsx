import React, { useEffect, useMemo, useState } from 'react';
import { Account, Transaction, TransactionScope, TransactionType, CustomCategory } from '../types';
import { useLanguage } from '../LanguageContext';
import { extractDateInputValue, stripInstallmentSuffix, suggestCategoryFromDescription, toStoredDate } from '../lib/transactions';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { XCircleIcon } from './icons/XCircleIcon';

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id'> & { id?: string }, scope: TransactionScope) => void;
  transaction: Transaction | null;
  allCategoriesMap: { [key: string]: { name: string } };
  allCategoryKeys: string[];
  customCategories: CustomCategory[];
  onAddCategory?: (category: { name: string; color: string }) => Promise<CustomCategory>;
  accounts?: Account[];
}

const QUICK_COLORS = ['#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#0891B2','#14B8A6','#6366F1','#6B7280'];

const TransactionForm: React.FC<TransactionFormProps> = ({
  isOpen, onClose, onSave, transaction, allCategoriesMap, allCategoryKeys, onAddCategory, accounts,
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
  const [accountId, setAccountId] = useState<string | null>(null);
  const [showQuickCategory, setShowQuickCategory] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState('');
  const [quickCategoryColor, setQuickCategoryColor] = useState('#3B82F6');
  const [isSavingQuickCategory, setIsSavingQuickCategory] = useState(false);
  // 'transfer' is a UI-only virtual type: saved as EXPENSE + transferToAccountId
  const [formType, setFormType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [transferToAccountId, setTransferToAccountId] = useState<string | null>(null);
  const [saveScope, setSaveScope] = useState<TransactionScope>('single');
  const isInstallmentSeries = Boolean(transaction?.seriesId && (transaction.installmentCount ?? 0) > 1);
  const shouldLockSeriesStructure = Boolean(transaction?.seriesId);

  useEffect(() => {
    if (transaction) {
      const resolvedScheduleType = transaction.scheduleType ?? (transaction.installmentCount && transaction.installmentCount > 1 ? 'installment' : transaction.isRecurring ? 'recurring' : 'once');
      const isTransfer = Boolean(transaction.transferToAccountId);
      setDescription(stripInstallmentSuffix(transaction.description));
      setAmount(String(transaction.amount));
      setDate(extractDateInputValue(transaction.date));
      setType(transaction.type);
      setFormType(isTransfer ? 'transfer' : transaction.type === TransactionType.INCOME ? 'income' : 'expense');
      setCategory(transaction.category);
      setScheduleType(resolvedScheduleType);
      setInstallmentCount(transaction.installmentCount ?? 2);
      setIsRecurring(!!transaction.isRecurring);
      setDueDate(extractDateInputValue(transaction.dueDate ?? undefined));
      setIsPaid(!!transaction.isPaid);
      setNotes(transaction.notes ?? '');
      setAccountId(transaction.accountId ?? null);
      setTransferToAccountId(transaction.transferToAccountId ?? null);
      setIsCategoryManuallySet(true);
      setSaveScope('single');
      setIsAdvancedOpen(
        !isTransfer && (
          !!transaction.notes || (
            transaction.type === TransactionType.EXPENSE && (
              resolvedScheduleType !== 'once'
              || !!transaction.dueDate
              || !!transaction.isPaid
            )
          )
        )
      );
      return;
    }

    setDescription('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setType(TransactionType.EXPENSE);
    setFormType('expense');
    setCategory('other');
    setScheduleType('once');
    setInstallmentCount(2);
    setIsRecurring(false);
    setDueDate('');
    setIsPaid(false);
    setNotes('');
    setAccountId(null);
    setTransferToAccountId(null);
    setIsCategoryManuallySet(false);
    setIsAdvancedOpen(false);
    setSaveScope('single');
  }, [transaction, isOpen]);

  // Sync the internal TransactionType when formType changes
  useEffect(() => {
    if (formType === 'income') {
      setType(TransactionType.INCOME);
    } else {
      // 'expense' and 'transfer' both store as EXPENSE
      setType(TransactionType.EXPENSE);
    }
  }, [formType]);

  useEffect(() => {
    if (isCategoryManuallySet) {
      return;
    }

    setCategory(suggestCategoryFromDescription(description, type, allCategoriesMap, allCategoryKeys));
  }, [allCategoriesMap, allCategoryKeys, description, isCategoryManuallySet, type]);

  useEffect(() => {
    if (formType === 'income') {
      setScheduleType('once');
      setInstallmentCount(2);
      setIsRecurring(false);
      setDueDate('');
      setIsPaid(true);
      return;
    }

    if (formType === 'transfer') {
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
  }, [transaction, formType]);

  useEffect(() => {
    if (formType !== 'expense') {
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
  }, [scheduleType, formType]);

  const resolvedCategoryName = allCategoriesMap[category]?.name ?? t('category');
  const summarySchedule = useMemo(() => {
    if (formType !== 'expense') {
      return null;
    }

    if (scheduleType === 'installment') {
      return t('schedule_installment');
    }

    if (scheduleType === 'recurring') {
      return t('schedule_recurring');
    }

    return null;
  }, [scheduleType, t, formType]);

  const handleSaveQuickCategory = async () => {
    if (!quickCategoryName.trim() || !onAddCategory) return;
    setIsSavingQuickCategory(true);
    try {
      const created = await onAddCategory({ name: quickCategoryName.trim(), color: quickCategoryColor });
      setCategory(created.key);
      setIsCategoryManuallySet(true);
      setShowQuickCategory(false);
      setQuickCategoryName('');
    } finally {
      setIsSavingQuickCategory(false);
    }
  };

  const parsedAmount = Number(amount);
  const amountPreview = Number.isFinite(parsedAmount) && amount !== ''
    ? parsedAmount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Number(0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!description || !amount) {
      return;
    }

    const isTransfer = formType === 'transfer';

    onSave({
      id: transaction?.id,
      description,
      amount: parseFloat(amount),
      date: toStoredDate(date),
      type,
      category: isTransfer ? 'transfer' : category,
      scheduleType: formType === 'expense' ? scheduleType : 'once',
      installmentCount: formType === 'expense' && scheduleType === 'installment' ? installmentCount : 1,
      isRecurring: formType === 'expense' && scheduleType === 'recurring',
      dueDate: formType === 'expense' && scheduleType === 'recurring' && dueDate ? toStoredDate(dueDate) : undefined,
      isPaid: formType === 'expense' ? isPaid : true,
      notes: isTransfer ? null : notes,
      accountId: accountId ?? null,
      transferToAccountId: isTransfer ? (transferToAccountId ?? null) : null,
    }, saveScope);
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
                  <p className="mt-1 text-base font-semibold text-slate-50">
                    {formType === 'income' ? t('income') : formType === 'transfer' ? 'Transferência' : t('expenses')}
                  </p>
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
                  <p className={`mt-1 text-3xl font-bold ${formType === 'income' ? 'text-emerald-300' : formType === 'transfer' ? 'text-cyan-300' : 'text-rose-200'}`}>
                    {formType === 'income' ? '+' : formType === 'transfer' ? '↔' : '-'} {amountPreview}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('category')}</p>
                  <p className="mt-1 text-sm font-medium text-slate-200">{resolvedCategoryName}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isInstallmentSeries ? (
                <section className="rounded-[24px] border border-cyan-400/20 bg-cyan-500/8 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{t('series_edit_scope')}</p>
                  <p className="mt-2 text-sm text-slate-300">{t('series_edit_scope_helper')}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-950/70 p-1">
                    <button
                      type="button"
                      onClick={() => setSaveScope('single')}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        saveScope === 'single' ? 'bg-slate-700 text-slate-50' : 'text-slate-400'
                      }`}
                    >
                      {t('edit_this_transaction')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaveScope('series')}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        saveScope === 'series' ? 'bg-cyan-500/20 text-cyan-100' : 'text-slate-400'
                      }`}
                    >
                      {t('edit_entire_series')}
                    </button>
                  </div>
                </section>
              ) : null}

              <section className="rounded-[24px] border border-white/10 bg-slate-900/60 p-4">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('type')}</p>
                  <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-950/70 p-1">
                    <button
                      type="button"
                      onClick={() => !shouldLockSeriesStructure && setFormType('expense')}
                      disabled={shouldLockSeriesStructure}
                      className={`rounded-2xl px-2 py-3 text-sm font-semibold transition ${formType === 'expense' ? 'bg-rose-500/20 text-rose-100' : 'text-slate-400'}`}
                    >
                      {t('expenses')}
                    </button>
                    <button
                      type="button"
                      onClick={() => !shouldLockSeriesStructure && setFormType('income')}
                      disabled={shouldLockSeriesStructure}
                      className={`rounded-2xl px-2 py-3 text-sm font-semibold transition ${formType === 'income' ? 'bg-emerald-500/20 text-emerald-100' : 'text-slate-400'}`}
                    >
                      {t('income')}
                    </button>
                    <button
                      type="button"
                      onClick={() => !shouldLockSeriesStructure && setFormType('transfer')}
                      disabled={shouldLockSeriesStructure}
                      className={`rounded-2xl px-2 py-3 text-sm font-semibold transition ${formType === 'transfer' ? 'bg-cyan-500/20 text-cyan-100' : 'text-slate-400'}`}
                    >
                      ↔ Transferir
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

              {accounts && accounts.length > 0 ? (
                formType === 'transfer' ? (
                  <section className="rounded-[24px] border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-400">Transferência entre contas</p>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-slate-400">De (origem)</label>
                      <select
                        value={accountId ?? ''}
                        onChange={e => setAccountId(e.target.value || null)}
                        className="input-base"
                        required
                      >
                        <option value="">Selecione a conta de origem</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id} disabled={acc.id === transferToAccountId}>
                            {acc.name}{acc.bank ? ` · ${acc.bank}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-center text-cyan-500 text-xl select-none">↓</div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-slate-400">Para (destino)</label>
                      <select
                        value={transferToAccountId ?? ''}
                        onChange={e => setTransferToAccountId(e.target.value || null)}
                        className="input-base"
                        required
                      >
                        <option value="">Selecione a conta de destino</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id} disabled={acc.id === accountId}>
                            {acc.name}{acc.bank ? ` · ${acc.bank}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="transfer-date" className="mb-2 block text-xs font-semibold text-slate-400">{t('date')}</label>
                      <input
                        id="transfer-date"
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="input-base"
                        required
                      />
                    </div>
                  </section>
                ) : (
                  <section className="rounded-[24px] border border-white/10 bg-slate-900/60 p-4">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Conta</label>
                    <select
                      value={accountId ?? ''}
                      onChange={e => setAccountId(e.target.value || null)}
                      className="input-base"
                    >
                      <option value="">Sem conta vinculada</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}{acc.bank ? ` · ${acc.bank}` : ''}
                        </option>
                      ))}
                    </select>
                  </section>
                )
              ) : null}

              {formType !== 'transfer' ? (
              <>
              <section className="rounded-[24px] border border-white/10 bg-slate-900/60 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="relative">
                    <label htmlFor="category" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('category')}</label>
                    <div className="flex gap-2">
                      <select
                        id="category"
                        value={category}
                        onChange={(event) => {
                          setCategory(event.target.value);
                          setIsCategoryManuallySet(true);
                        }}
                        className="input-base flex-1"
                      >
                        {allCategoryKeys.map(catKey => (
                          <option key={catKey} value={catKey}>
                            {allCategoriesMap[catKey].name}
                          </option>
                        ))}
                      </select>
                      {onAddCategory ? (
                        <button
                          type="button"
                          onClick={() => setShowQuickCategory(v => !v)}
                          className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-slate-900/70 px-3 text-xl font-bold text-slate-300 transition hover:border-[var(--app-primary)] hover:text-white"
                          aria-label={t('add_category')}
                          title={t('add_category')}
                        >
                          +
                        </button>
                      ) : null}
                    </div>

                    {/* Quick category mini-modal */}
                    {showQuickCategory ? (
                      <div className="absolute left-0 right-0 top-full z-20 mt-2 animate-fade-in-up rounded-[20px] border border-white/10 bg-slate-900 p-4 shadow-2xl">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('add_category')}</p>
                        <input
                          type="text"
                          value={quickCategoryName}
                          onChange={e => setQuickCategoryName(e.target.value)}
                          placeholder={t('category_name_placeholder')}
                          className="input-base mb-3"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleSaveQuickCategory(); } if (e.key === 'Escape') setShowQuickCategory(false); }}
                        />
                        <div className="mb-3 flex flex-wrap gap-2">
                          {QUICK_COLORS.map(c => (
                            <button
                              key={c}
                              type="button"
                              className={`h-6 w-6 rounded-full border-2 transition ${quickCategoryColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                              style={{ backgroundColor: c }}
                              onClick={() => setQuickCategoryColor(c)}
                            />
                          ))}
                        </div>
                        <div className="flex justify-end gap-2">
                          <button type="button" className="button-secondary !py-1.5 !text-sm" onClick={() => setShowQuickCategory(false)}>{t('cancel')}</button>
                          <button
                            type="button"
                            className="button-primary !py-1.5 !text-sm"
                            disabled={!quickCategoryName.trim() || isSavingQuickCategory}
                            onClick={() => void handleSaveQuickCategory()}
                          >
                            {t('save')}
                          </button>
                        </div>
                      </div>
                    ) : null}
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
                    {formType === 'expense' ? (
                      <>
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('schedule_type')}</label>
                        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-950/70 p-1">
                          {(['once', 'installment', 'recurring'] as const).map(option => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => !shouldLockSeriesStructure && setScheduleType(option)}
                              disabled={shouldLockSeriesStructure}
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
                            disabled={shouldLockSeriesStructure}
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
              </>
              ) : null}

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
