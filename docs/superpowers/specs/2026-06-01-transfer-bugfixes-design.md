# Design: Correção de Bugs Críticos — Feature Transferências

**Data:** 2026-06-01  
**Escopo:** 4 bugs confirmados pelo code review da feature de transferências entre contas  
**Estratégia:** Um único commit cirúrgico, sem regressão de comportamento existente

---

## Contexto

A feature de transferências entre contas foi implementada nos commits `3637259` e `e0c5fa4`. O code review identificou 4 bugs que afetam dados exibidos ao usuário e integridade de dados em edições de série.

---

## Bugs e Fixes

### Fix #1 — BalanceEvolutionChart: loop in-period não exclui transferências

**Arquivo:** `Front-end/components/BalanceEvolutionChart.tsx` (~linha 89)

**Problema:** Transferências têm `type === EXPENSE`, então caem no bucket de despesas e deflacionam a linha de saldo, mesmo sendo neutras ao patrimônio.

**Fix:** Adicionar guard `&& !tx.transferToAccountId` no else do loop:

```ts
// Antes:
} else {
  result[idx].expense += tx.amount;
}

// Depois:
} else if (!tx.transferToAccountId) {
  result[idx].expense += tx.amount;
}
```

**Padrão:** Idêntico ao já aplicado em `App.tsx`, `ExpenseChart.tsx` e `pdf-export.ts`.

---

### Fix #2 — BalanceEvolutionChart: acumulador pré-período não exclui transferências

**Arquivo:** `Front-end/components/BalanceEvolutionChart.tsx` (~linha 100)

**Problema:** O saldo inicial (soma de transações antes do período) subtrai transferências como se fossem despesas reais, deslocando toda a linha de saldo para baixo.

**Fix:** Pular transferências no reduce:

```ts
// Antes:
return tx.type === TransactionType.INCOME
  ? acc + tx.amount
  : acc - tx.amount;

// Depois:
if (tx.transferToAccountId) return acc; // neutro ao patrimônio
return tx.type === TransactionType.INCOME
  ? acc + tx.amount
  : acc - tx.amount;
```

---

### Fix #3 — buildTransactionSeriesUpdateRows: sobrescreve account_id de todas as parcelas

**Arquivo:** `Front-end/services/supabase-helpers.ts` (~linhas 333–335)

**Problema:** Ao editar "série inteira", o `account_id` e `transfer_to_account_id` da parcela editada são propagados para todas as parcelas irmãs, destruindo atribuições individuais de conta.

**Fix (opção A — preservar contas por parcela):** Remover os campos do payload de update de série:

```ts
// Remover estas duas linhas do objeto retornado:
account_id: transaction.accountId ?? null,
transfer_to_account_id: transaction.transferToAccountId ?? null,
```

**Decisão de design:** Editar a série inteira nunca altera a conta de nenhuma parcela. Contas são propriedade individual de cada parcela.

---

### Fix #4 — Dashboard: transferência sem accountId credita destino sem debitar origem

**Arquivo:** `Front-end/components/Dashboard.tsx` (~linha 43)

**Problema:** Se uma transferência no banco tem `transferToAccountId` preenchido mas `accountId` nulo, a conta destino é creditada sem nenhuma conta ser debitada, inflando artificialmente o saldo calculado.

**Fix:** Exigir ambos os campos para processar a transferência:

```ts
// Antes:
if (tx.transferToAccountId) {
  if (tx.accountId) { /* debita origem */ }
  netByAccount.set(tx.transferToAccountId, ... + tx.amount); // sempre executa
}

// Depois:
if (tx.transferToAccountId && tx.accountId) { // ambos obrigatórios
  netByAccount.set(tx.accountId, ... - tx.amount);
  netByAccount.set(tx.transferToAccountId, ... + tx.amount);
}
```

---

### Fix #5 — TransactionForm: submit silencioso quando contas de transferência faltam

**Arquivo:** `Front-end/components/TransactionForm.tsx` (~linha 323)

**Problema:** Se o usuário tenta salvar uma transferência sem selecionar conta destino, o form retorna silenciosamente sem nenhum feedback, simulando uma falha invisível.

**Fix:** Usar `showNotification` (já disponível via contexto) para exibir erro:

```ts
// Antes:
if (isTransfer && (!accountId || !transferToAccountId)) {
  return;
}

// Depois:
if (isTransfer && (!accountId || !transferToAccountId)) {
  showNotification('Selecione a conta de origem e de destino para a transferência.', 'error');
  return;
}
```

---

## Arquivos Alterados

| Arquivo | Linhas alteradas | Natureza |
|---|---|---|
| `Front-end/components/BalanceEvolutionChart.tsx` | ~89, ~100 | Guard `!tx.transferToAccountId` em 2 lugares |
| `Front-end/services/supabase-helpers.ts` | ~333–335 | Remoção de 2 campos do payload |
| `Front-end/components/Dashboard.tsx` | ~43 | Condição `&& tx.accountId` |
| `Front-end/components/TransactionForm.tsx` | ~323 | `showNotification` + return |

---

## O que NÃO muda

- Comportamento de edição de parcela única (`scope: 'single'`) — não é afetado
- Transferências novas — continuam funcionando normalmente
- Qualquer lógica de autenticação, exportação ou importação

---

## Estratégia de entrega

- Um único commit: `fix: correct transfer handling in chart, series update, dashboard and form`
- Sem testes unitários novos (os bugs são de lógica simples e visualmente verificáveis)
- Verificar manualmente após o fix: criar uma transferência e confirmar que o gráfico não mostra barra vermelha
