import React, { useEffect, useState } from 'react';
import { Account, AccountType } from '../types';
import { useLanguage } from '../LanguageContext';
import { TrashIcon } from './icons/TrashIcon';
import { XCircleIcon } from './icons/XCircleIcon';

interface AccountManagerModalProps {
  isOpen: boolean;
  accounts: Account[];
  onClose: () => void;
  onAdd: (account: Omit<Account, 'id'>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking:    'Conta corrente',
  savings:     'Poupança',
  credit_card: 'Cartão de crédito',
  investment:  'Investimento',
  cash:        'Dinheiro',
};

const ACCOUNT_ICONS: { value: string; label: string }[] = [
  { value: 'bank',    label: '🏦' },
  { value: 'wallet',  label: '👛' },
  { value: 'card',    label: '💳' },
  { value: 'piggy',   label: '🐷' },
  { value: 'invest',  label: '📈' },
  { value: 'cash',    label: '💵' },
];

const ACCOUNT_COLORS = [
  '#3B82F6','#10B981','#8B5CF6','#F59E0B','#EF4444',
  '#EC4899','#0891B2','#6366F1','#14B8A6','#6B7280',
];

const EMPTY_FORM: Omit<Account, 'id'> = {
  name: '',
  bank: '',
  accountType: 'checking',
  initialBalance: 0,
  color: '#3B82F6',
  icon: 'bank',
};

const AccountManagerModal: React.FC<AccountManagerModalProps> = ({
  isOpen, accounts, onClose, onAdd, onDelete,
}) => {
  const { formatCurrency } = useLanguage();
  const [form, setForm] = useState<Omit<Account, 'id'>>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setForm(EMPTY_FORM);
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setIsSaving(true);
    try {
      await onAdd({ ...form, name: form.name.trim(), bank: form.bank?.trim() || null });
      setForm(EMPTY_FORM);
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-100 focus:border-[var(--app-primary)] focus:outline-none';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-[28px] border border-white/10 bg-slate-800 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Finanças</p>
            <h2 className="mt-0.5 text-xl font-bold text-slate-50">Contas bancárias</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 p-2 text-slate-400 hover:text-white">
            <XCircleIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {/* Existing accounts */}
          {accounts.length > 0 && (
            <div className="mb-6 space-y-2">
              {accounts.map(acc => (
                <div
                  key={acc.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: `${acc.color}22` }}>
                    {ACCOUNT_ICONS.find(i => i.value === acc.icon)?.label ?? '🏦'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-100 truncate">{acc.name}</p>
                    <p className="text-xs text-slate-400">
                      {acc.bank ? `${acc.bank} · ` : ''}{ACCOUNT_TYPE_LABELS[acc.accountType]}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-300">
                      {formatCurrency(acc.initialBalance)}
                    </p>
                    <p className="text-xs text-slate-500">saldo inicial</p>
                  </div>
                  {deleteConfirmId === acc.id ? (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        className="rounded-xl bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/30"
                        onClick={async () => { await onDelete(acc.id); setDeleteConfirmId(null); }}
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-white/10 px-2 py-1 text-xs text-slate-400"
                        onClick={() => setDeleteConfirmId(null)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="ml-1 p-2 text-slate-600 hover:text-rose-400"
                      onClick={() => setDeleteConfirmId(acc.id)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* New account form */}
          <form onSubmit={handleSubmit}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Nova conta</p>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Nome *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Conta principal"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Banco</label>
                  <input
                    type="text"
                    value={form.bank ?? ''}
                    onChange={e => setForm(f => ({ ...f, bank: e.target.value }))}
                    placeholder="Ex: Nubank"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Tipo</label>
                  <select
                    value={form.accountType}
                    onChange={e => setForm(f => ({ ...f, accountType: e.target.value as AccountType }))}
                    className={inputCls}
                  >
                    {(Object.entries(ACCOUNT_TYPE_LABELS) as [AccountType, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Saldo inicial</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.initialBalance}
                    onChange={e => setForm(f => ({ ...f, initialBalance: Number(e.target.value) }))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Ícone</label>
                  <div className="flex flex-wrap gap-2">
                    {ACCOUNT_ICONS.map(ic => (
                      <button
                        key={ic.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, icon: ic.value }))}
                        className={`h-9 w-9 rounded-xl border text-lg transition ${form.icon === ic.value ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/15' : 'border-white/10 bg-slate-900/50'}`}
                      >
                        {ic.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Cor</label>
                  <div className="flex flex-wrap gap-2">
                    {ACCOUNT_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, color: c }))}
                        className={`h-6 w-6 rounded-full border-2 transition ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="button-secondary" onClick={onClose}>Fechar</button>
              <button type="submit" className="button-primary" disabled={isSaving || !form.name.trim()}>
                {isSaving ? 'Salvando...' : 'Adicionar conta'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AccountManagerModal;
