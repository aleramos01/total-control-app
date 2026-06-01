import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType } from '../types';
import { useLanguage } from '../LanguageContext';
import { PieChartIcon } from './icons/PieChartIcon';
import { BarChartIcon } from './icons/BarChartIcon';
import { getAvailableMonths } from '../lib/transactions';

interface ChartData {
  category: string;
  value: number;
  percentage: number;
  color: string;
}

interface TooltipData {
  x: number;
  y: number;
  label: string;
  value: number;
  percentage: string;
}

interface ExpenseChartProps {
    transactions: Transaction[];
    allCategoriesMap: { [key: string]: { name: string; color: string } };
}

const ExpenseChart: React.FC<ExpenseChartProps> = ({ transactions, allCategoriesMap }) => {
  const { t, locale: appLocale, formatCurrency } = useLanguage();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  type ChartPeriod = '3m' | '6m' | '1a' | 'all';
  const [period, setPeriod] = useState<ChartPeriod>('all');
  const [specificMonth, setSpecificMonth] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);

  const chartData = useMemo((): ChartData[] => {
    let startMs: number | null = null;
    let endMs: number | null = null;

    if (specificMonth) {
      const [year, month] = specificMonth.split('-').map(Number);
      startMs = Date.UTC(year, month - 1, 1);
      endMs = Date.UTC(year, month, 0) + 86_400_000 - 1;
    } else if (period !== 'all') {
      const days = period === '3m' ? 90 : period === '6m' ? 180 : 365;
      endMs = Date.now();
      startMs = endMs - days * 86_400_000;
    }

    const filtered = transactions.filter(tx => {
      if (tx.type !== TransactionType.EXPENSE || tx.transferToAccountId) return false;
      if (startMs === null) return true;
      const txMs = new Date(tx.date).getTime();
      return txMs >= startMs && txMs <= endMs!;
    });

    const totalExpenses = filtered.reduce((acc, tx) => acc + tx.amount, 0);
    if (totalExpenses === 0) return [];

    const categoryTotals = filtered.reduce((acc: Record<string, number>, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
      return acc;
    }, {});

    return (Object.entries(categoryTotals) as Array<[string, number]>)
      .map(([categoryKey, value]) => ({
        category: categoryKey,
        value,
        percentage: (value / totalExpenses) * 100,
        color: allCategoriesMap[categoryKey]?.color || '#6B7280',
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, period, specificMonth, allCategoriesMap]);

  const NoDataDisplay = () => (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-slate-900/30 px-6 py-12 text-center">
      <svg className="mx-auto mb-4 h-14 w-14 text-slate-700" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect x="6" y="36" width="10" height="20" rx="3" fill="currentColor" opacity="0.5" />
        <rect x="21" y="24" width="10" height="32" rx="3" fill="currentColor" opacity="0.7" />
        <rect x="36" y="14" width="10" height="42" rx="3" fill="currentColor" />
        <rect x="51" y="28" width="10" height="28" rx="3" fill="currentColor" opacity="0.6" />
        <line x1="4" y1="58" x2="60" y2="58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p className="font-semibold text-slate-300">{t('no_expense_data')}</p>
      <p className="mt-1 text-sm text-slate-500">
        {appLocale === 'en-US'
          ? 'Add expenses to see the distribution by category.'
          : 'Adicione despesas para ver a distribuição por categoria.'}
      </p>
    </div>
  );

  const polarToCartesian = (cx: number, cy: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: cx + radius * Math.cos(angleInRadians),
      y: cy + radius * Math.sin(angleInRadians),
    };
  };

  const getArcPath = (cx: number, cy: number, radius: number, startAngle: number, endAngle: number) => {
    if (endAngle - startAngle >= 360) {
      endAngle = startAngle + 359.99;
    }
    const start = polarToCartesian(cx, cy, radius, endAngle);
    const end = polarToCartesian(cx, cy, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    const d = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} L ${cx} ${cy} Z`;
    return d;
  };
  
  let cumulativeAngle = 0;

  const handleMouseOver = (e: React.MouseEvent, data: ChartData) => {
    setTooltip({
        x: e.clientX,
        y: e.clientY,
        label: allCategoriesMap[data.category]?.name || data.category,
        value: data.value,
        percentage: data.percentage.toFixed(1)
    });
  }

  const handleMouseOut = () => {
    setTooltip(null);
  }

  return (
    <div className="mt-8">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h2 className="text-2xl font-bold text-slate-300">{t('expense_distribution')}</h2>
            <div className="flex items-center gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  <div className="flex items-center text-sm bg-slate-900/50 p-1 rounded-lg">
                    {(['3m', '6m', '1a', 'all'] as ChartPeriod[]).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => { setPeriod(p); setSpecificMonth(null); }}
                        className={`py-1 px-3 rounded-md transition-colors ${
                          !specificMonth && period === p ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {p === '3m' ? '3 meses' : p === '6m' ? '6 meses' : p === '1a' ? '1 ano' : 'Tudo'}
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
                      aria-label="Selecionar mês específico"
                      className="text-sm bg-slate-900/50 p-1 rounded-lg text-slate-400 hover:text-white transition focus:outline-none"
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
                <div className="flex items-center text-sm bg-slate-900/50 p-1 rounded-lg">
                    <button onClick={() => setChartType('pie')} aria-label={t('pie_chart_aria')} className={`p-1.5 rounded-md transition-colors ${chartType === 'pie' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}> <PieChartIcon className="h-5 w-5"/> </button>
                    <button onClick={() => setChartType('bar')} aria-label={t('bar_chart_aria')} className={`p-1.5 rounded-md transition-colors ${chartType === 'bar' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}> <BarChartIcon className="h-5 w-5"/> </button>
                </div>
            </div>
        </div>
        
        {chartData.length === 0 ? <NoDataDisplay /> : (
            <div className={`bg-slate-800/50 backdrop-blur-sm p-5 rounded-xl border border-slate-700 flex gap-6 ${chartType === 'pie' ? 'flex-col md:flex-row items-center' : 'flex-col'}`}>
                {chartType === 'pie' && (
                    <div className="relative w-48 h-48 flex-shrink-0">
                        <svg viewBox="0 0 100 100">
                            {chartData.map(data => {
                                const startAngle = cumulativeAngle;
                                const endAngle = cumulativeAngle + (data.percentage / 100) * 360;
                                cumulativeAngle = endAngle;
                                return (
                                    <path
                                        key={data.category}
                                        d={getArcPath(50, 50, 50, startAngle, endAngle)}
                                        fill={data.color}
                                        onMouseMove={(e) => handleMouseOver(e, data)}
                                        onMouseLeave={handleMouseOut}
                                        className="transition-transform duration-200 transform hover:scale-105 cursor-pointer"
                                    />
                                );
                            })}
                        </svg>
                    </div>
                )}
                <div className="flex-1 w-full">
                    {chartType === 'pie' ? (
                        <ul className="space-y-2">
                            {chartData.map(data => (
                                <li key={data.category} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }}></span>
                                        <span className="text-slate-300">{allCategoriesMap[data.category]?.name || data.category}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-slate-200">{formatCurrency(data.value)}</span>
                                        <span className="ml-2 text-slate-400">({data.percentage.toFixed(1)}%)</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <ul className="space-y-4">
                            {chartData.map(data => (
                                <li key={data.category} className="text-sm space-y-1.5">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-slate-300 font-medium">{allCategoriesMap[data.category]?.name || data.category}</span>
                                        <span className="font-semibold text-slate-200">{formatCurrency(data.value)}</span>
                                    </div>
                                    <div className="w-full bg-slate-700 rounded-full h-2.5">
                                        <div 
                                            className="h-2.5 rounded-full transition-all duration-500 ease-out" 
                                            style={{ width: `${data.percentage}%`, backgroundColor: data.color }}
                                            onMouseMove={(e) => handleMouseOver(e, data)}
                                            onMouseLeave={handleMouseOut}
                                        ></div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                {tooltip && (
                    <div 
                        className="fixed bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 shadow-lg pointer-events-none z-50"
                        style={{ left: tooltip.x + 15, top: tooltip.y + 15 }}
                    >
                        <p className="font-bold">{tooltip.label}</p>
                        <p>{formatCurrency(tooltip.value)} ({tooltip.percentage}%)</p>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default ExpenseChart;
