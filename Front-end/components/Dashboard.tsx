import React, { useMemo } from 'react';
import { Account, Transaction, TransactionType } from '../types';
import { useLanguage } from '../LanguageContext';

interface DashboardProps {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  upcomingCount: number;
  accounts?: Account[];
  transactions?: Transaction[];
}

const ACCOUNT_ICON_MAP: Record<string, string> = {
  bank: '🏦', wallet: '👛', card: '💳', piggy: '🐷', invest: '📈', cash: '💵',
};

// Module-level stable empty arrays — prevents useMemo from re-running every render
// when the parent omits these optional props (default `= []` creates a new reference each call).
const NO_ACCOUNTS: Account[] = [];
const NO_TRANSACTIONS: Transaction[] = [];

const Dashboard: React.FC<DashboardProps> = ({
  totalIncome, totalExpenses, balance, upcomingCount,
  accounts = NO_ACCOUNTS, transactions = NO_TRANSACTIONS,
}) => {
  const { t, formatCurrency } = useLanguage();

  const accountBalances = useMemo(() => {
    if (accounts.length === 0) return [];

    // Pre-index transactions by accountId (O(n)) so per-account lookup is O(1).
    // Transfers: source account loses the amount, destination account gains it.
    const netByAccount = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.transferToAccountId) {
        // Transfer: money moves between accounts — net-zero for overall wealth
        if (tx.accountId) {
          netByAccount.set(tx.accountId, (netByAccount.get(tx.accountId) ?? 0) - tx.amount);
        }
        netByAccount.set(tx.transferToAccountId, (netByAccount.get(tx.transferToAccountId) ?? 0) + tx.amount);
      } else if (tx.accountId) {
        const delta = tx.type === TransactionType.INCOME ? tx.amount : -tx.amount;
        netByAccount.set(tx.accountId, (netByAccount.get(tx.accountId) ?? 0) + delta);
      }
    }

    return accounts.map(acc => ({
      ...acc,
      currentBalance: acc.initialBalance + (netByAccount.get(acc.id) ?? 0),
    }));
  }, [accounts, transactions]);

  const cards = [
    { label: t('income'),         value: formatCurrency(totalIncome),   tone: 'text-emerald-400' },
    { label: t('expenses'),       value: formatCurrency(totalExpenses), tone: 'text-rose-400'    },
    { label: t('balance'),        value: formatCurrency(balance),       tone: balance >= 0 ? 'text-cyan-300' : 'text-amber-300' },
    { label: t('upcoming_bills'), value: String(upcomingCount),         tone: 'text-[var(--app-primary)]' },
  ];

  return (
    <>
      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => (
          <article
            key={card.label}
            className="animate-fade-in-up rounded-[24px] border border-white/10 bg-slate-800/70 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.28)] backdrop-blur"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <p className="text-sm font-medium text-slate-400">{card.label}</p>
            <p className={`mt-3 text-3xl font-extrabold ${card.tone}`}>{card.value}</p>
          </article>
        ))}
      </section>

      {accountBalances.length > 0 && (
        <section className="mb-6 animate-fade-in-up rounded-[28px] border border-white/10 bg-slate-800/70 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.28)] backdrop-blur" style={{ animationDelay: '320ms' }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Saldo por conta</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {accountBalances.map(acc => (
              <div
                key={acc.id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{ backgroundColor: `${acc.color}22` }}
                >
                  {ACCOUNT_ICON_MAP[acc.icon] ?? '🏦'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">{acc.name}</p>
                  {acc.bank ? <p className="text-xs text-slate-500">{acc.bank}</p> : null}
                </div>
                <p className={`font-bold ${acc.currentBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {formatCurrency(acc.currentBalance)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
};

export default Dashboard;
