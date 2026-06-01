# Resumo all-time vs Transações filtradas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar os dados do Resumo (sempre all-time) dos dados da aba Transações (com filtro de período), e adicionar seletor de período próprio nos gráficos do Resumo.

**Architecture:** Dois fetches independentes em `App.tsx` — `summaryTransactions` (sem filtro de data) e `filteredTransactions` (com `transactionFilters`). Os gráficos `BalanceEvolutionChart` e `ExpenseChart` recebem `summaryTransactions` e filtram client-side via seletor local.

**Tech Stack:** React 18, TypeScript, Supabase (client-side query), Node.js test runner (testes em `Front-end/tests/`)

---

## File Map

| Arquivo | O que muda |
|---------|------------|
| `Front-end/lib/transactions.ts` | Adiciona `getAvailableMonths()` |
| `Front-end/tests/transactions.test.ts` | Adiciona teste para `getAvailableMonths` |
| `Front-end/App.tsx` | Divide fetch/estado em summary vs filtered; renomeia `filters`→`transactionFilters` |
| `Front-end/components/BalanceEvolutionChart.tsx` | Atualiza seletor de período: remove `30d`, adiciona `1a`, `Tudo`, `Mês específico` |
| `Front-end/components/ExpenseChart.tsx` | Substitui `viewMode (week/month)` por seletor de período igual ao BalanceEvolutionChart |

---

## Task 1: Utilitário `getAvailableMonths`

**Files:**
- Modify: `Front-end/lib/transactions.ts`
- Test: `Front-end/tests/transactions.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Abrir `Front-end/tests/transactions.test.ts` e adicionar ao final:

```ts
import {
  // imports existentes...
  getAvailableMonths,
} from '../lib/transactions.js';

test('getAvailableMonths returns unique months sorted descending', () => {
  const make = (date: string): Transaction => ({
    id: date,
    date,
    description: 'test',
    amount: 100,
    type: TransactionType.EXPENSE,
    category: 'food',
    isRecurring: false,
    isPaid: true,
    dueDate: null,
    accountId: null,
    transferToAccountId: null,
  });

  const txs = [
    make('2026-05-15'),
    make('2026-05-20'),
    make('2026-04-10'),
    make('2026-06-01'),
  ];

  const months = getAvailableMonths(txs);
  assert.deepEqual(months, ['2026-06', '2026-05', '2026-04']);
});

test('getAvailableMonths returns empty array for empty input', () => {
  assert.deepEqual(getAvailableMonths([]), []);
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd Front-end && node --test tests/transactions.test.ts 2>&1 | tail -20
```

Esperado: erro `getAvailableMonths is not a function` ou similar.

- [ ] **Step 3: Implementar `getAvailableMonths` em `lib/transactions.ts`**

Adicionar ao final do arquivo (antes do último export ou ao final):

```ts
export function getAvailableMonths(transactions: Transaction[]): string[] {
  const months = new Set<string>();
  for (const tx of transactions) {
    months.add(tx.date.slice(0, 7));
  }
  return [...months].sort((a, b) => b.localeCompare(a));
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
cd Front-end && node --test tests/transactions.test.ts 2>&1 | tail -20
```

Esperado: todos os testes passam, sem falhas.

- [ ] **Step 5: Commit**

```bash
git add Front-end/lib/transactions.ts Front-end/tests/transactions.test.ts
git commit -m "feat: add getAvailableMonths utility"
```

---

## Task 2: Dividir fetch de dados em `App.tsx`

**Files:**
- Modify: `Front-end/App.tsx`

Esta task não tem teste unitário — o comportamento é validado manualmente ao abrir o app e verificar que o Resumo mostra all-time enquanto filtrar em Transações não afeta o Resumo.

- [ ] **Step 1: Renomear estado `filters` → `transactionFilters` e `transactions` → `filteredTransactions`**

No topo do componente `App`, localizar:

```ts
const [filters, setFilters] = useState<TransactionFilters>(defaultCurrentMonthFilters);
// ...
const [transactions, setTransactions] = useState<Transaction[]>([]);
```

Substituir por:

```ts
const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>(defaultCurrentMonthFilters);
// ...
const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
const [summaryTransactions, setSummaryTransactions] = useState<Transaction[]>([]);
```

- [ ] **Step 2: Dividir `fetchData` em dois callbacks**

Localizar o callback `fetchData` existente e substituí-lo completamente por dois callbacks:

```ts
const fetchSummaryData = useCallback(async () => {
  if (!isAuthenticated) {
    setSummaryTransactions([]);
    setCustomCategories([]);
    setDataError(null);
    setIsLoading(false);
    return;
  }

  setIsLoading(true);
  setDataError(null);
  try {
    const [transactionsData, categoriesData, accountsData] = await Promise.all([
      api.fetchTransactions({}),
      api.fetchCustomCategories(),
      api.fetchAccounts().catch((err: unknown) => {
        console.error('[fetchAccounts] failed:', err);
        return [] as Account[];
      }),
    ]);
    setSummaryTransactions(transactionsData);
    setCustomCategories(categoriesData);
    setAccounts(accountsData);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch data';
    setDataError(message);
    showNotification(message, 'error');
  } finally {
    setIsLoading(false);
  }
}, [isAuthenticated, showNotification]);

const fetchFilteredTransactions = useCallback(async () => {
  if (!isAuthenticated) {
    setFilteredTransactions([]);
    return;
  }
  try {
    const data = await api.fetchTransactions(transactionFilters);
    setFilteredTransactions(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch transactions';
    showNotification(message, 'error');
  }
}, [isAuthenticated, transactionFilters, showNotification]);
```

- [ ] **Step 3: Atualizar os `useEffect` de fetch**

Localizar o `useEffect` que chama `fetchData` e substituir por dois:

```ts
useEffect(() => {
  fetchSummaryData();
}, [fetchSummaryData]);

useEffect(() => {
  fetchFilteredTransactions();
}, [fetchFilteredTransactions]);
```

- [ ] **Step 4: Atualizar `totals` para usar `summaryTransactions`**

Localizar o `useMemo` de `totals` e atualizar a variável `transactions` para `summaryTransactions`:

```ts
const totals = useMemo(() => {
  const totalIncome = summaryTransactions
    .filter(transaction => transaction.type === TransactionType.INCOME && !transaction.transferToAccountId)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalExpenses = summaryTransactions
    .filter(transaction => transaction.type === TransactionType.EXPENSE && !transaction.transferToAccountId)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const upcomingCount = summaryTransactions.filter(transaction => transaction.isRecurring && transaction.dueDate).length;
  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    upcomingCount,
  };
}, [summaryTransactions]);
```

- [ ] **Step 5: Atualizar referências de `fetchData` nos handlers**

Localizar todos os lugares onde `fetchData()` é chamado dentro de handlers (ex: `handleSaveTransaction`, `handleConfirmImport`, `handleConfirmStatementImport`). Substituir por:

```ts
fetchSummaryData();
fetchFilteredTransactions();
```

São três ocorrências no arquivo. Buscar por `fetchData()` e substituir todas.

- [ ] **Step 6: Atualizar props dos componentes na aba summary**

Localizar o bloco JSX `{activeTab === 'summary' ? (` e atualizar as props de cada componente para usar `summaryTransactions`:

```tsx
<Dashboard
  totalIncome={totals.totalIncome}
  totalExpenses={totals.totalExpenses}
  balance={totals.balance}
  upcomingCount={totals.upcomingCount}
  accounts={accounts}
  transactions={summaryTransactions}
  onAddAccount={() => setIsAccountModalOpen(true)}
/>
<UpcomingBills
  transactions={summaryTransactions}
  onTogglePaidStatus={handleTogglePaidStatus}
  allCategoriesMap={allCategoriesMap}
/>
<BalanceEvolutionChart transactions={summaryTransactions} />
<ExpenseChart transactions={summaryTransactions} allCategoriesMap={allCategoriesMap} />
```

- [ ] **Step 7: Atualizar props do `TransactionList`**

Localizar `<TransactionList` e atualizar:

```tsx
<TransactionList
  transactions={filteredTransactions}
  filters={transactionFilters}
  onFiltersChange={setTransactionFilters}
  onEdit={(id) => {
    const transaction = filteredTransactions.find(item => item.id === id) ?? null;
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  }}
  onDelete={handleDeleteTransaction}
  onOpenCategoryModal={() => setIsCategoryModalOpen(true)}
  onExportCsv={handleExportCsv}
  onExportJson={handleExportJson}
  onExportPdf={handleExportPdf}
  onImportJson={handleImportJson}
  onImportStatementCsv={handleImportStatementCsv}
  onImportStatementOfx={handleImportStatementOfx}
  onResetFilters={() => setTransactionFilters(defaultCurrentMonthFilters)}
  onDeleteMany={handleDeleteTransactions}
  onTogglePaidMany={handleTogglePaidMany}
  allCategoriesMap={allCategoriesMap}
/>
```

- [ ] **Step 8: Atualizar referências a `transactions` e `filters` nos handlers restantes**

Localizar `handleExportPdf` — ele usa `filters`. Atualizar:

```ts
const handleExportPdf = useCallback(() => {
  if (filteredTransactions.length === 0) {
    showNotification(t('export_csv_empty'), 'error');
    return;
  }
  const symbol = appSettings.currency === 'USD' ? '$' : 'R$';
  const period = transactionFilters.preset === 'current_month' || !transactionFilters.from
    ? new Date().toISOString().slice(0, 7)
    : transactionFilters.from.slice(0, 7);
  exportTransactionsPdf({
    transactions: filteredTransactions,
    allCategoriesMap,
    productName: brandSettings.productName,
    currencySymbol: symbol,
    period,
  });
}, [allCategoriesMap, appSettings.currency, brandSettings.productName, transactionFilters, showNotification, t, filteredTransactions]);
```

Localizar `handleExportCsv` — atualizar `transactions` para `filteredTransactions`:

```ts
const handleExportCsv = useCallback(() => {
  if (filteredTransactions.length === 0) {
    showNotification(t('export_csv_empty'), 'error');
    return;
  }
  const csv = buildTransactionsCsv(filteredTransactions, allCategoriesMap);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildTransactionsCsvFilename();
  link.click();
  URL.revokeObjectURL(url);
}, [allCategoriesMap, showNotification, t, filteredTransactions]);
```

Localizar `handleDeleteTransaction` e `handleDeleteTransactions` — eles usam `setTransactions`. Atualizar para usar `setFilteredTransactions` e chamar `fetchSummaryData()` após deletar:

```ts
const handleDeleteTransaction = useCallback(async (id: string) => {
  try {
    await api.deleteTransaction(id);
    setFilteredTransactions(prev => prev.filter(item => item.id !== id));
    setSummaryTransactions(prev => prev.filter(item => item.id !== id));
    showNotification(t('transaction_deleted_success'), 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete transaction';
    showNotification(message, 'error');
  }
}, [showNotification, t]);

const handleDeleteTransactions = useCallback(async (ids: string[]) => {
  try {
    await api.deleteTransactions(ids);
    setFilteredTransactions(prev => prev.filter(item => !ids.includes(item.id)));
    setSummaryTransactions(prev => prev.filter(item => !ids.includes(item.id)));
    showNotification(t('transactions_deleted_success').replace('{count}', String(ids.length)), 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete transactions';
    showNotification(message, 'error');
  }
}, [showNotification, t]);
```

Localizar `handleTogglePaidStatus` e `handleTogglePaidMany` — atualizar `setTransactions` para atualizar ambos os estados:

```ts
const handleTogglePaidStatus = useCallback(async (id: string, isPaid: boolean) => {
  try {
    const updatedTransaction = await api.toggleTransactionPaidStatus(id, isPaid);
    const updater = (prev: Transaction[]) => prev.map(item => item.id === id ? updatedTransaction : item);
    setFilteredTransactions(updater);
    setSummaryTransactions(updater);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update transaction';
    showNotification(message, 'error');
  }
}, [showNotification]);

const handleTogglePaidMany = useCallback(async (ids: string[], isPaid: boolean) => {
  try {
    const updatedTransactions = await api.toggleTransactionsPaidStatus(ids, isPaid);
    const updatedMap = new Map(updatedTransactions.map(transaction => [transaction.id, transaction]));
    const updater = (prev: Transaction[]) => prev.map(item => updatedMap.get(item.id) ?? item);
    setFilteredTransactions(updater);
    setSummaryTransactions(updater);
    showNotification(
      (isPaid ? t('transactions_marked_paid_success') : t('transactions_marked_unpaid_success')).replace('{count}', String(updatedTransactions.length)),
      'success',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update transactions';
    showNotification(message, 'error');
  }
}, [showNotification, t]);
```

Localizar `handleSaveTransaction` — atualizar `setTransactions` e `transactions.find`:

```ts
const handleSaveTransaction = useCallback(async (transaction: Omit<Transaction, 'id'> & { id?: string }, scope: TransactionScope) => {
  try {
    const savedTransactions = await api.saveTransactionBatch(transaction, scope);
    if (transaction.id) {
      const updatedMap = new Map(savedTransactions.map(item => [item.id, item]));
      const updater = (prev: Transaction[]) => prev.map(item => updatedMap.get(item.id) ?? item);
      setFilteredTransactions(updater);
      setSummaryTransactions(updater);
    } else {
      fetchSummaryData();
      fetchFilteredTransactions();
    }
    const successMessage = !transaction.id
      ? t('transaction_added_success')
      : scope === 'series'
        ? t('transaction_series_updated_success')
        : t('transaction_updated_success');
    showNotification(successMessage, 'success');
    setIsModalOpen(false);
    setEditingTransaction(null);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save transaction';
    showNotification(message, 'error');
  }
}, [fetchSummaryData, fetchFilteredTransactions, showNotification, t]);
```

- [ ] **Step 9: Verificar se `shouldBlockDataViews` ainda funciona**

Localizar:

```ts
const shouldBlockDataViews = Boolean(dataError && !isLoading && transactions.length === 0 && customCategories.length === 0);
```

Atualizar para:

```ts
const shouldBlockDataViews = Boolean(dataError && !isLoading && summaryTransactions.length === 0 && customCategories.length === 0);
```

- [ ] **Step 10: Verificar TypeScript**

```bash
cd Front-end && npx tsc --noEmit 2>&1 | head -40
```

Esperado: sem erros. Se houver erros de `transactions` ou `filters` não encontrados, localizar e corrigir.

- [ ] **Step 11: Commit**

```bash
git add Front-end/App.tsx
git commit -m "feat: split summary and transaction data fetches"
```

---

## Task 3: Novo seletor de período em `BalanceEvolutionChart`

**Files:**
- Modify: `Front-end/components/BalanceEvolutionChart.tsx`

- [ ] **Step 1: Substituir o tipo `Period` e o array `PERIODS`**

Localizar no topo do arquivo:

```ts
type Period = '30d' | '3m' | '6m' | '12m';

interface PeriodOption {
  id: Period;
  label: string;
  days: number;
  bucketDays: number;
}

const PERIODS: PeriodOption[] = [
  { id: '30d', label: '30 dias', days: 30,  bucketDays: 1  },
  { id: '3m',  label: '3 meses', days: 90,  bucketDays: 7  },
  { id: '6m',  label: '6 meses', days: 180, bucketDays: 30 },
  { id: '12m', label: '12 meses',days: 365, bucketDays: 30 },
];
```

Substituir por:

```ts
type Period = '3m' | '6m' | '1a' | 'all';

interface PeriodOption {
  id: Period;
  label: string;
}

const PERIODS: PeriodOption[] = [
  { id: '3m',  label: '3 meses'  },
  { id: '6m',  label: '6 meses'  },
  { id: '1a',  label: '1 ano'    },
  { id: 'all', label: 'Tudo'     },
];
```

- [ ] **Step 2: Adicionar estado para `specificMonth` e importar `getAvailableMonths`**

Localizar o import de `useLanguage`:

```ts
import { useLanguage } from '../LanguageContext';
```

Adicionar após os imports existentes:

```ts
import { getAvailableMonths } from '../lib/transactions';
```

Localizar dentro do componente:

```ts
const [period, setPeriod] = useState<Period>('3m');
```

Substituir por:

```ts
const [period, setPeriod] = useState<Period>('all');
const [specificMonth, setSpecificMonth] = useState<string | null>(null);
```

- [ ] **Step 3: Calcular meses disponíveis e derivar `activeMonth`**

Logo após a declaração dos estados, adicionar:

```ts
const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);
```

- [ ] **Step 4: Reescrever o `useMemo` de `buckets` para suportar os novos períodos**

Localizar o `useMemo` de `buckets` e substituir completamente por:

```ts
const buckets = useMemo((): Bucket[] => {
  const now = new Date();

  // Determina o intervalo de datas e granularidade dos buckets
  let startMs: number;
  let bucketDays: number;

  if (specificMonth) {
    // Mês específico: do dia 1 ao último dia do mês
    const [year, month] = specificMonth.split('-').map(Number);
    startMs = new Date(year, month - 1, 1).getTime();
    const endOfMonth = new Date(year, month, 0);
    bucketDays = 1;
    const count = endOfMonth.getDate();
    const result: Bucket[] = Array.from({ length: count }, (_, i) => {
      const d = new Date(year, month - 1, i + 1);
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      return { label, income: 0, expense: 0, balance: 0 };
    });

    const endMs = endOfMonth.getTime() + 86_400_000 - 1;

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

  if (period === 'all') {
    if (transactions.length === 0) return [];
    const dates = transactions.map(tx => new Date(tx.date).getTime());
    startMs = Math.min(...dates);
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
    const label = bucketDays === 1
      ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })
      : bucketDays === 7
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

  let running = period === 'all' ? 0 : transactions.reduce((acc, tx) => {
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
}, [transactions, period, specificMonth]);
```

- [ ] **Step 5: Remover a linha `const opt = PERIODS.find(...)` que não é mais usada**

Localizar:

```ts
const opt = PERIODS.find(p => p.id === period)!;
```

Remover esta linha (o `opt` não é mais necessário, o novo `useMemo` usa `period` diretamente).

- [ ] **Step 6: Atualizar o JSX do seletor de período**

Localizar o bloco JSX com os botões de período:

```tsx
<div className="flex rounded-xl border border-white/10 bg-slate-900/60 p-0.5">
  {PERIODS.map(p => (
    <button
      key={p.id}
      type="button"
      onClick={() => setPeriod(p.id)}
      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
        period === p.id ? 'bg-slate-700 text-slate-50' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {p.label}
    </button>
  ))}
</div>
```

Substituir por:

```tsx
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
```

- [ ] **Step 7: Verificar TypeScript**

```bash
cd Front-end && npx tsc --noEmit 2>&1 | grep BalanceEvolution
```

Esperado: nenhum erro.

- [ ] **Step 8: Commit**

```bash
git add Front-end/components/BalanceEvolutionChart.tsx
git commit -m "feat: update BalanceEvolutionChart with new period selector (3m/6m/1a/Tudo/mês)"
```

---

## Task 4: Novo seletor de período em `ExpenseChart`

**Files:**
- Modify: `Front-end/components/ExpenseChart.tsx`

- [ ] **Step 1: Adicionar importação de `getAvailableMonths`**

Localizar os imports no topo:

```ts
import { useLanguage } from '../LanguageContext';
```

Adicionar:

```ts
import { getAvailableMonths } from '../lib/transactions';
```

- [ ] **Step 2: Substituir o estado `viewMode` pelo novo `period` e `specificMonth`**

Localizar:

```ts
const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
```

Substituir por:

```ts
type ChartPeriod = '3m' | '6m' | '1a' | 'all';
const [period, setPeriod] = useState<ChartPeriod>('all');
const [specificMonth, setSpecificMonth] = useState<string | null>(null);
```

Logo após, adicionar:

```ts
const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);
```

- [ ] **Step 3: Reescrever o `useMemo` de `chartData` para usar os novos filtros**

Localizar o `useMemo` de `chartData` e substituir completamente:

```ts
const chartData = useMemo((): ChartData[] => {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  let startDate: Date | null = null;
  let endDate: Date = now;

  if (specificMonth) {
    const [year, month] = specificMonth.split('-').map(Number);
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 0, 23, 59, 59, 999);
  } else if (period !== 'all') {
    const days = period === '3m' ? 90 : period === '6m' ? 180 : 365;
    startDate = new Date(now.getTime() - days * 86_400_000);
    startDate.setHours(0, 0, 0, 0);
  }

  const filtered = transactions.filter(tx => {
    if (tx.type !== TransactionType.EXPENSE || tx.transferToAccountId) return false;
    if (!startDate) return true;
    const txDate = new Date(tx.date);
    return txDate >= startDate && txDate <= endDate;
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
```

- [ ] **Step 4: Substituir o seletor de período no JSX**

Localizar o bloco JSX que renderiza os botões `this_week` / `this_month`:

```tsx
<div className="flex items-center text-sm bg-slate-900/50 p-1 rounded-lg">
    <button onClick={() => setViewMode('week')} className={`py-1 px-3 rounded-md transition-colors ${viewMode === 'week' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>{t('this_week')}</button>
    <button onClick={() => setViewMode('month')} className={`py-1 px-3 rounded-md transition-colors ${viewMode === 'month' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>{t('this_month')}</button>
</div>
```

Substituir por:

```tsx
<div className="flex flex-wrap items-center gap-1">
  <div className="flex rounded-xl border border-white/10 bg-slate-900/60 p-0.5">
    {(['3m', '6m', '1a', 'all'] as ChartPeriod[]).map(p => (
      <button
        key={p}
        type="button"
        onClick={() => { setPeriod(p); setSpecificMonth(null); }}
        className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
          !specificMonth && period === p ? 'bg-slate-700 text-slate-50' : 'text-slate-400 hover:text-slate-200'
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
```

- [ ] **Step 5: Verificar TypeScript**

```bash
cd Front-end && npx tsc --noEmit 2>&1 | grep ExpenseChart
```

Esperado: nenhum erro.

- [ ] **Step 6: Verificar TypeScript geral**

```bash
cd Front-end && npx tsc --noEmit 2>&1 | head -40
```

Esperado: sem erros em nenhum arquivo.

- [ ] **Step 7: Commit**

```bash
git add Front-end/components/ExpenseChart.tsx
git commit -m "feat: update ExpenseChart with new period selector (3m/6m/1a/Tudo/mês)"
```

---

## Self-Review

### Cobertura do spec

| Requisito do spec | Task que implementa |
|-------------------|---------------------|
| Resumo usa `summaryTransactions` (sem filtro de data) | Task 2 |
| Transações usa `filteredTransactions` (com `transactionFilters`) | Task 2 |
| Filtro de transações não afeta o Resumo | Task 2 (dois fetches independentes) |
| `totals` usa `summaryTransactions` | Task 2 - Step 4 |
| Gráficos recebem `summaryTransactions` | Task 2 - Step 6 |
| BalanceEvolutionChart: presets 3m, 6m, 1a, Tudo | Task 3 |
| BalanceEvolutionChart: mês específico (dropdown) | Task 3 - Step 6 |
| ExpenseChart: presets 3m, 6m, 1a, Tudo | Task 4 |
| ExpenseChart: mês específico (dropdown) | Task 4 - Step 4 |
| `getAvailableMonths` extrai meses disponíveis | Task 1 |
| Transações: sem mudança de comportamento padrão | Confirmado — `defaultCurrentMonthFilters` mantido |
| Dois fetches em paralelo no carregamento | Task 2 — dois `useEffect` independentes disparam em paralelo |

### Verificação de nomes consistentes

- `summaryTransactions` — usado em Tasks 2, 3, 4 consistentemente
- `filteredTransactions` — usado em Task 2 consistentemente  
- `transactionFilters` — usado em Task 2 consistentemente
- `getAvailableMonths` — definido em Task 1, importado em Tasks 3 e 4
- `specificMonth` — estado local em BalanceEvolutionChart (Task 3) e ExpenseChart (Task 4) — nomes idênticos por design
