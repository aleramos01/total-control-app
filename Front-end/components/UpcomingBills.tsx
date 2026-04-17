import React from 'react';
import { Transaction, TransactionType } from '../types';
import { useLanguage } from '../LanguageContext';
import ConfirmationDialog from './ConfirmationDialog';
import { getUpcomingBills } from '../lib/transactions';

interface UpcomingBillsProps {
  transactions: Transaction[];
  onTogglePaidStatus: (id: string, isPaid: boolean) => void;
  allCategoriesMap: { [key: string]: { name: string; color: string } };
}

const UpcomingBills: React.FC<UpcomingBillsProps> = ({ transactions, onTogglePaidStatus, allCategoriesMap }) => {
  const { t, formatCurrency } = useLanguage();
  const [billToToggle, setBillToToggle] = React.useState<Transaction | null>(null);

  const upcomingBills = React.useMemo(() => {
    return getUpcomingBills(transactions);
  }, [transactions]);

  const getDueDateStatus = (diffDays: number) => {
    if (diffDays < 0) {
      return t('overdue_by_days').replace('{days}', String(Math.abs(diffDays)));
    }
    if (diffDays === 0) {
      return t('due_today');
    }
    return t('due_in_days').replace('{days}', String(diffDays));
  };

  return (
    <>
      <section className="rounded-[28px] border border-white/10 bg-slate-800/65 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-100">{t('recurring_table_title')}</h2>
          <p className="text-sm text-slate-400">{t('upcoming_bills')}</p>
        </div>

        {upcomingBills.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 px-4 py-8 text-center text-slate-400">
            {t('no_upcoming_bills')}
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingBills.map(bill => (
              <div key={bill.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: allCategoriesMap[bill.category]?.color || '#64748b' }} />
                  <div>
                    <p className="font-semibold text-slate-100">{bill.description}</p>
                    <p className="text-sm text-slate-400">{allCategoriesMap[bill.category]?.name || bill.category}</p>
                  </div>
                </div>
                <div className="grid gap-1 text-sm">
                  <p className="font-semibold text-slate-100">{formatCurrency(bill.amount)}</p>
                  <p className="text-slate-400">{getDueDateStatus(bill.diffDays)}</p>
                </div>
                <button type="button" className="button-secondary justify-center" onClick={() => setBillToToggle(bill)}>
                  {bill.isPaid ? t('mark_as_unpaid') : t('mark_as_paid')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {billToToggle && (
        <ConfirmationDialog
          isOpen={!!billToToggle}
          onClose={() => setBillToToggle(null)}
          onConfirm={() => {
            onTogglePaidStatus(billToToggle.id, !billToToggle.isPaid);
            setBillToToggle(null);
          }}
          title={t('confirm_button')}
          message={billToToggle.isPaid ? t('mark_as_unpaid') : t('mark_as_paid')}
          confirmButtonText={t('confirm_button')}
        />
      )}
    </>
  );
};

export default UpcomingBills;
