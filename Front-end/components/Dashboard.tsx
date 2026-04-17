import React from 'react';
import { useLanguage } from '../LanguageContext';

interface DashboardProps {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  upcomingCount: number;
}

const Dashboard: React.FC<DashboardProps> = ({ totalIncome, totalExpenses, balance, upcomingCount }) => {
  const { t, formatCurrency } = useLanguage();

  const cards = [
    { label: t('income'), value: formatCurrency(totalIncome), tone: 'text-emerald-400' },
    { label: t('expenses'), value: formatCurrency(totalExpenses), tone: 'text-rose-400' },
    { label: t('balance'), value: formatCurrency(balance), tone: balance >= 0 ? 'text-cyan-300' : 'text-amber-300' },
    { label: t('upcoming_bills'), value: String(upcomingCount), tone: 'text-[var(--app-primary)]' },
  ];

  return (
    <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => (
        <article key={card.label} className="rounded-[24px] border border-white/10 bg-slate-800/70 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.28)] backdrop-blur">
          <p className="text-sm font-medium text-slate-400">{card.label}</p>
          <p className={`mt-3 text-3xl font-extrabold ${card.tone}`}>{card.value}</p>
        </article>
      ))}
    </section>
  );
};

export default Dashboard;
