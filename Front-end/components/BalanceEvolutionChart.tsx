import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType } from '../types';
import { useLanguage } from '../LanguageContext';
import { getAvailableMonths } from '../lib/transactions';

interface BalanceEvolutionChartProps {
  transactions: Transaction[];
}

type Period = '3m' | '6m' | '1a' | 'all';

interface PeriodOption {
  id: Period;
  label: string;
}

const PERIODS: PeriodOption[] = [
  { id: '3m',  label: '3 meses' },
  { id: '6m',  label: '6 meses' },
  { id: '1a',  label: '1 ano'   },
  { id: 'all', label: 'Tudo'    },
];

interface Bucket {
  label: string;
  income: number;
  expense: number;
  balance: number;
}

interface TooltipInfo {
  x: number;
  y: number;
  bucket: Bucket;
}

const W = 480;
const H = 180;
const PAD = { top: 16, right: 12, bottom: 32, left: 58 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

function niceMax(value: number): number {
  if (value === 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  return Math.ceil(value / magnitude) * magnitude;
}

function formatCompact(value: number, currency: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const sym = currency === 'USD' ? '$' : 'R$';
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)    return `${sign}${sym}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}

const BalanceEvolutionChart: React.FC<BalanceEvolutionChartProps> = ({ transactions }) => {
  const { formatCurrency } = useLanguage();
  const [period, setPeriod] = useState<Period>('all');
  const [specificMonth, setSpecificMonth] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);

  const buckets = useMemo((): Bucket[] => {
    const now = new Date();

    if (specificMonth) {
      const [year, month] = specificMonth.split('-').map(Number);
      const startMs = Date.UTC(year, month - 1, 1);
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const count = daysInMonth;
      const endMs = Date.UTC(year, month, 0) + 86_400_000 - 1;

      const result: Bucket[] = Array.from({ length: count }, (_, i) => {
        const d = new Date(Date.UTC(year, month - 1, i + 1));
        const label = d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
        return { label, income: 0, expense: 0, balance: 0 };
      });

      transactions.forEach(tx => {
        const txMs = new Date(tx.date).getTime();
        if (txMs < startMs || txMs > endMs) return;
        const idx = Math.min(Math.floor((txMs - startMs) / 86_400_000), count - 1);
        if (tx.type === TransactionType.INCOME && !tx.transferToAccountId) {
          result[idx].income += tx.amount;
        } else if (!tx.transferToAccountId) {
          result[idx].expense += tx.amount;
        }
      });

      let running = transactions.reduce((acc, tx) => {
        const txMs = new Date(tx.date).getTime();
        if (txMs >= startMs) return acc;
        if (tx.transferToAccountId) return acc;
        return tx.type === TransactionType.INCOME ? acc + tx.amount : acc - tx.amount;
      }, 0);

      result.forEach(b => {
        running += b.income - b.expense;
        b.balance = running;
      });

      return result;
    }

    let startMs: number;
    let bucketDays: number;

    if (period === 'all') {
      if (transactions.length === 0) return [];
      startMs = transactions.reduce((min, tx) => {
        const ms = new Date(tx.date).getTime();
        return ms < min ? ms : min;
      }, Infinity);
      bucketDays = 30;
    } else {
      const days = period === '3m' ? 90 : period === '6m' ? 180 : 365;
      startMs = now.getTime() - days * 86_400_000;
      bucketDays = period === '3m' ? 7 : 30;
    }

    const bucketMs = bucketDays * 86_400_000;
    const totalMs = now.getTime() - startMs;
    const count = Math.max(1, Math.ceil(totalMs / bucketMs));

    const result: Bucket[] = Array.from({ length: count }, (_, i) => {
      const d = new Date(startMs + i * bucketMs);
      const label = bucketDays <= 7
        ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })
        : d.toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'short', year: '2-digit' });
      return { label, income: 0, expense: 0, balance: 0 };
    });

    transactions.forEach(tx => {
      const txMs = new Date(tx.date).getTime();
      if (txMs < startMs || txMs > now.getTime()) return;
      const idx = Math.min(Math.floor((txMs - startMs) / bucketMs), count - 1);
      if (tx.type === TransactionType.INCOME && !tx.transferToAccountId) {
        result[idx].income += tx.amount;
      } else if (!tx.transferToAccountId) {
        result[idx].expense += tx.amount;
      }
    });

    const running0 = period === 'all' ? 0 : transactions.reduce((acc, tx) => {
      const txMs = new Date(tx.date).getTime();
      if (txMs >= startMs) return acc;
      if (tx.transferToAccountId) return acc;
      return tx.type === TransactionType.INCOME ? acc + tx.amount : acc - tx.amount;
    }, 0);

    let running = running0;
    result.forEach(b => {
      running += b.income - b.expense;
      b.balance = running;
    });

    return result;
  }, [transactions, period, specificMonth]);

  const yMax = useMemo(() => {
    const peak = Math.max(
      ...buckets.map(b => b.income),
      ...buckets.map(b => b.expense),
      ...buckets.map(b => Math.abs(b.balance)),
    );
    return niceMax(peak);
  }, [buckets]);

  const hasData = buckets.some(b => b.income > 0 || b.expense > 0);

  // Scale helpers
  const sy = (v: number) => CH - Math.min((Math.abs(v) / yMax) * CH, CH);
  const barW = Math.max(2, Math.min((CW / buckets.length) * 0.35, 14));
  const slotW = CW / buckets.length;

  // Label step: show every Nth label to avoid crowding
  const labelStep = buckets.length <= 12 ? 1 : buckets.length <= 30 ? Math.ceil(buckets.length / 10) : Math.ceil(buckets.length / 8);

  // Balance line path
  const linePath = buckets.map((b, i) => {
    const cx = PAD.left + i * slotW + slotW / 2;
    const cy = PAD.top + (b.balance >= 0 ? sy(b.balance) : CH);
    return `${i === 0 ? 'M' : 'L'} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
  }).join(' ');

  const currencyCode = formatCurrency(0).includes('$') ? 'USD' : 'BRL';

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>, bucket: Bucket) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 8, bucket });
  };

  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-800/70 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.28)] backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-50">Evolução do Saldo</h2>
          <p className="text-sm text-slate-400">Entradas, saídas e saldo acumulado no período</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <div className="flex rounded-xl border border-white/10 bg-slate-900/60 p-0.5">
            {PERIODS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setPeriod(p.id); setSpecificMonth(null); }}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  !specificMonth && period === p.id ? 'bg-slate-700 text-slate-50' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {availableMonths.length > 0 && (
            <select
              value={specificMonth ?? ''}
              onChange={e => {
                const val = e.target.value;
                if (val) setSpecificMonth(val);
                else { setSpecificMonth(null); setPeriod('all'); }
              }}
              className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:text-slate-200 focus:outline-none"
            >
              <option value="">Mês específico</option>
              {availableMonths.map(m => {
                const [year, month] = m.split('-');
                const label = new Date(Number(year), Number(month) - 1, 1)
                  .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                return <option key={m} value={m}>{label}</option>;
              })}
            </select>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-[20px] border border-dashed border-white/10 bg-slate-900/30 py-10 text-center">
          <p className="text-sm text-slate-500">Nenhuma transação no período selecionado.</p>
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[320px]"
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Y-axis gridlines */}
            {[0, 0.25, 0.5, 0.75, 1].map(frac => {
              const cy = PAD.top + frac * CH;
              const val = yMax * (1 - frac);
              return (
                <g key={frac}>
                  <line
                    x1={PAD.left} y1={cy} x2={W - PAD.right} y2={cy}
                    stroke="rgba(148,163,184,0.08)" strokeWidth="1"
                  />
                  <text
                    x={PAD.left - 4} y={cy + 4}
                    textAnchor="end" fontSize="9" fill="rgba(148,163,184,0.5)"
                  >
                    {formatCompact(val, currencyCode)}
                  </text>
                </g>
              );
            })}

            {/* Bars + X labels */}
            {buckets.map((b, i) => {
              const cx = PAD.left + i * slotW + slotW / 2;
              const incH = Math.max(1, (b.income / yMax) * CH);
              const expH = Math.max(1, (b.expense / yMax) * CH);
              const baseY = PAD.top + CH;

              return (
                <g
                  key={i}
                  onMouseMove={e => handleMouseMove(e, b)}
                  onMouseLeave={() => setTooltip(null)}
                  className="cursor-pointer"
                >
                  {/* Income bar */}
                  <rect
                    x={cx - barW - 1} y={baseY - incH}
                    width={barW} height={incH}
                    rx="2" fill="#10B981" opacity="0.75"
                  />
                  {/* Expense bar */}
                  <rect
                    x={cx + 1} y={baseY - expH}
                    width={barW} height={expH}
                    rx="2" fill="#F43F5E" opacity="0.75"
                  />
                  {/* X label */}
                  {i % labelStep === 0 ? (
                    <text
                      x={cx} y={H - 6}
                      textAnchor="middle" fontSize="8.5" fill="rgba(148,163,184,0.55)"
                    >
                      {b.label}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {/* Balance line */}
            <path d={linePath} fill="none" stroke="#22D3EE" strokeWidth="1.5" strokeLinejoin="round" />

            {/* Balance dots */}
            {buckets.map((b, i) => {
              const cx = PAD.left + i * slotW + slotW / 2;
              const cy = PAD.top + sy(b.balance);
              return (
                <circle
                  key={i}
                  cx={cx} cy={cy} r="2.5"
                  fill="#22D3EE" stroke="#0f172a" strokeWidth="1"
                  onMouseMove={e => handleMouseMove(e, b)}
                  onMouseLeave={() => setTooltip(null)}
                  className="cursor-pointer"
                />
              );
            })}
          </svg>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/80" /> Receitas</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500/80" /> Despesas</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-px w-5 bg-cyan-400" /> Saldo</span>
          </div>

          {/* Tooltip */}
          {tooltip ? (
            <div
              className="pointer-events-none absolute rounded-xl border border-white/10 bg-slate-900/96 px-3 py-2 text-xs shadow-xl"
              style={{ left: Math.min(tooltip.x + 12, W - 140), top: Math.max(tooltip.y - 60, 0) }}
            >
              <p className="mb-1 font-semibold text-slate-200">{tooltip.bucket.label}</p>
              <p className="text-emerald-300">↑ {formatCurrency(tooltip.bucket.income)}</p>
              <p className="text-rose-300">↓ {formatCurrency(tooltip.bucket.expense)}</p>
              <p className={`mt-1 font-bold ${tooltip.bucket.balance >= 0 ? 'text-cyan-300' : 'text-amber-300'}`}>
                Saldo: {formatCurrency(tooltip.bucket.balance)}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default BalanceEvolutionChart;
