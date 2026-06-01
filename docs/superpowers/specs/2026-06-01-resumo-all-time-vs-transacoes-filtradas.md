# Resumo all-time vs Transações filtradas

**Data:** 2026-06-01  
**Status:** Aprovado

## Problema

O estado `filters` e o fetch `fetchTransactions(filters)` são compartilhados entre a aba Resumo e a aba Transações. Quando o usuário aplica um filtro de período nas Transações (ex: "Mês anterior"), o Resumo também reflete esse filtro, exibindo totais parciais em vez de totais históricos completos.

## Objetivo

- **Resumo:** sempre exibe totais acumulados de todos os meses (sem filtro de data).
- **Transações:** mantém filtro de período (padrão: sem filtro, mostra tudo — comportamento atual).
- **Gráficos no Resumo:** possuem seletor de período próprio (client-side), sem afetar os cards de totais.

---

## Arquitetura de dados

### Dois fetches independentes (Opção 1 escolhida)

```
(sem filtro de data) → fetchTransactions({}) → summaryTransactions[]
                                                      ↓
                                   Resumo: cards, contas, gráficos

transactionFilters → fetchTransactions(transactionFilters) → filteredTransactions[]
                                                                     ↓
                                                    Aba Transações: tabela
```

Ambos os fetches são disparados em paralelo no carregamento e quando necessário.

---

## Mudanças em `App.tsx`

| Antes | Depois |
|-------|--------|
| `filters` | `transactionFilters` (mesmo propósito, escopo restrito à aba Transações) |
| `transactions` | `filteredTransactions` (alimentado por `transactionFilters`) |
| — | `summaryTransactions` (novo, sempre sem filtro de data) |
| `fetchData()` | `fetchSummaryData()` + `fetchFilteredTransactions()` |

- `totals` (Receitas, Despesas, Saldo, Contas a vencer) calculado sobre `summaryTransactions`.
- `Dashboard`, `UpcomingBills`, `BalanceEvolutionChart`, `ExpenseChart` recebem `summaryTransactions`.
- `TransactionList` recebe `filteredTransactions` + `transactionFilters`.

---

## Seletor de período nos gráficos

**Componentes:** `BalanceEvolutionChart` e `ExpenseChart`

**Estado:** local em cada componente (não sobe para `App.tsx`).

**Opções de período:**
- `3m` — últimos 3 meses
- `6m` — últimos 6 meses
- `1a` — último ano
- `Tudo` — sem filtro (padrão)
- Mês específico — dropdown com os meses que têm transações em `summaryTransactions`

**Implementação:** filtra `summaryTransactions` com `.filter()` client-side. Nenhum request extra ao servidor.

---

## Aba Transações — sem mudança de comportamento

- Filtro padrão: `{ preset: '' }` (sem filtro, mostra tudo — mantém comportamento atual).
- O seletor de período, tipo, categoria etc. continuam funcionando como hoje.
- A única mudança é que esses filtros não afetam mais o Resumo.

---

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `Front-end/App.tsx` | Divisão do estado e dos fetches |
| `Front-end/components/BalanceEvolutionChart.tsx` | Adiciona seletor de período local |
| `Front-end/components/ExpenseChart.tsx` | Adiciona seletor de período local |

---

## Fora de escopo

- Filtro de conta no Resumo (não solicitado).
- Mudança no comportamento padrão da aba Transações.
- Alterações no backend.
