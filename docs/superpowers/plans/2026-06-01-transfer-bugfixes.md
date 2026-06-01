# Transfer Bugfixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 5 bugs críticos introduzidos pela feature de transferências entre contas que causam dados incorretos no gráfico, perda silenciosa de dados em edição de série e submit sem feedback.

**Architecture:** Quatro arquivos modificados cirurgicamente — cada fix é 1-4 linhas. Sem novos arquivos, sem mudanças de interface, sem regressão de comportamento existente.

**Tech Stack:** React 18, TypeScript, Supabase JS client, Vite

---

## Mapa de Arquivos

| Arquivo | O que muda |
|---|---|
| `Front-end/components/BalanceEvolutionChart.tsx` | Linhas 89–92 e 100–102: guards `!tx.transferToAccountId` |
| `Front-end/services/supabase-helpers.ts` | Linhas 336–337: remover `account_id` e `transfer_to_account_id` do payload de série |
| `Front-end/components/Dashboard.tsx` | Linha 38: adicionar `&& tx.accountId` à condição de transferência |
| `Front-end/components/TransactionForm.tsx` | Linha 1–7 (import) + linha 42 (hook) + linha 219–221 (guard com feedback) |

---

## Task 1: BalanceEvolutionChart — excluir transferências do loop in-period

**Files:**
- Modify: `Front-end/components/BalanceEvolutionChart.tsx:89-93`

**Contexto:** Transferências são salvas com `type === EXPENSE`. Sem o guard, cada transferência gera uma barra vermelha e depress a linha de saldo, mesmo sendo neutra ao patrimônio. O padrão correto já existe em `App.tsx`, `ExpenseChart.tsx` e `pdf-export.ts`.

- [ ] **Step 1: Aplicar o fix no loop in-period**

Em `Front-end/components/BalanceEvolutionChart.tsx`, localizar as linhas 89–93:

```ts
// ANTES (linhas 89–93):
      if (tx.type === TransactionType.INCOME) {
        result[idx].income += tx.amount;
      } else {
        result[idx].expense += tx.amount;
      }
```

Substituir por:

```ts
// DEPOIS:
      if (tx.type === TransactionType.INCOME && !tx.transferToAccountId) {
        result[idx].income += tx.amount;
      } else if (!tx.transferToAccountId) {
        result[idx].expense += tx.amount;
      }
      // transferências (transferToAccountId set) são ignoradas — neutras ao patrimônio
```

- [ ] **Step 2: Verificar visualmente**

Confirmar que a linha alterada agora tem `!tx.transferToAccountId` em ambos os branches. O arquivo não deve ter erros de TypeScript.

---

## Task 2: BalanceEvolutionChart — excluir transferências do acumulador pré-período

**Files:**
- Modify: `Front-end/components/BalanceEvolutionChart.tsx:97-103`

**Contexto:** O acumulador `running` soma todas as transações anteriores ao período selecionado para obter o saldo inicial correto. Sem o guard, transferências anteriores reduzem o saldo inicial, deslocando toda a linha de saldo para baixo.

- [ ] **Step 1: Aplicar o fix no acumulador pré-período**

Em `Front-end/components/BalanceEvolutionChart.tsx`, localizar as linhas 97–103:

```ts
// ANTES (linhas 97–103):
    let running = transactions.reduce((acc, tx) => {
      const txMs = new Date(tx.date).getTime();
      if (txMs >= startMs) return acc;
      return tx.type === TransactionType.INCOME
        ? acc + tx.amount
        : acc - tx.amount;
    }, 0);
```

Substituir por:

```ts
// DEPOIS:
    let running = transactions.reduce((acc, tx) => {
      const txMs = new Date(tx.date).getTime();
      if (txMs >= startMs) return acc;
      if (tx.transferToAccountId) return acc; // neutro ao patrimônio
      return tx.type === TransactionType.INCOME
        ? acc + tx.amount
        : acc - tx.amount;
    }, 0);
```

- [ ] **Step 2: Verificar e commitar as Tasks 1 e 2 juntas**

As duas mudanças estão no mesmo arquivo. Commitar juntas:

```bash
git add Front-end/components/BalanceEvolutionChart.tsx
git commit -m "fix: exclude transfers from BalanceEvolutionChart buckets and baseline"
```

Saída esperada: `1 file changed, 3 insertions(+), 2 deletions(-)`

---

## Task 3: supabase-helpers — não sobrescrever account_id em edição de série

**Files:**
- Modify: `Front-end/services/supabase-helpers.ts:336-337`

**Contexto:** `buildTransactionSeriesUpdateRows` itera todas as parcelas irmãs e monta um payload de update. Desde o commit de transferências, o payload inclui `account_id` e `transfer_to_account_id` da parcela editada — sobrescrevendo os valores individuais de cada parcela. Decisão de design: editar "série inteira" nunca deve alterar a conta de nenhuma parcela; contas são propriedade individual de cada installment.

- [ ] **Step 1: Remover os campos do payload de série**

Em `Front-end/services/supabase-helpers.ts`, localizar as linhas 325–339 (função `buildTransactionSeriesUpdateRows`, objeto de retorno):

```ts
// ANTES — remover as linhas 336–337:
      account_id: transaction.accountId ?? null,
      transfer_to_account_id: transaction.transferToAccountId ?? null,
```

O objeto completo deve ficar assim após a remoção:

```ts
    return {
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      category_key: transaction.category,
      transaction_date: nextDate,
      schedule_type: row.schedule_type,
      series_id: row.series_id,
      installment_index: row.installment_index,
      installment_count: row.installment_count,
      is_recurring: row.is_recurring,
      due_date: nextDueDate,
      is_paid: Boolean(transaction.isPaid),
      notes: transaction.notes ?? null,
      // account_id e transfer_to_account_id intencionalmente omitidos:
      // cada parcela preserva sua própria conta — editar a série não redistribui contas.
      updated_at: now,
    };
```

- [ ] **Step 2: Commitar**

```bash
git add Front-end/services/supabase-helpers.ts
git commit -m "fix: preserve per-installment account_id when editing entire series"
```

Saída esperada: `1 file changed, 1 insertion(+), 2 deletions(-)`

---

## Task 4: Dashboard — exigir accountId para processar transferência

**Files:**
- Modify: `Front-end/components/Dashboard.tsx:38-47`

**Contexto:** Se uma transferência no banco tem `transferToAccountId` preenchido mas `accountId` nulo (dado inconsistente), a conta destino é creditada sem nenhuma origem ser debitada — inflando artificialmente o saldo total calculado. O fix exige que ambos os campos existam para processar o movimento.

- [ ] **Step 1: Adicionar guard no bloco de transferência**

Em `Front-end/components/Dashboard.tsx`, localizar as linhas 38–47:

```ts
// ANTES (linhas 38–47):
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
```

Substituir por:

```ts
// DEPOIS:
      if (tx.transferToAccountId && tx.accountId) {
        // Transferência válida: ambas as contas devem existir para mover o saldo
        netByAccount.set(tx.accountId, (netByAccount.get(tx.accountId) ?? 0) - tx.amount);
        netByAccount.set(tx.transferToAccountId, (netByAccount.get(tx.transferToAccountId) ?? 0) + tx.amount);
      } else if (tx.accountId) {
        const delta = tx.type === TransactionType.INCOME ? tx.amount : -tx.amount;
        netByAccount.set(tx.accountId, (netByAccount.get(tx.accountId) ?? 0) + delta);
      }
```

- [ ] **Step 2: Commitar**

```bash
git add Front-end/components/Dashboard.tsx
git commit -m "fix: require both accountId and transferToAccountId to process transfer balance"
```

Saída esperada: `1 file changed, 2 insertions(+), 4 deletions(-)`

---

## Task 5: TransactionForm — feedback de erro no submit silencioso

**Files:**
- Modify: `Front-end/components/TransactionForm.tsx:1-7` (imports)
- Modify: `Front-end/components/TransactionForm.tsx:42` (hook)
- Modify: `Front-end/components/TransactionForm.tsx:219-221` (guard)

**Contexto:** `TransactionForm` não importa `useNotification`. O guard de submit silencioso está na linha 219. Precisamos adicionar o import, o hook e substituir o `return` silencioso por uma notificação de erro.

- [ ] **Step 1: Adicionar import de useNotification**

Em `Front-end/components/TransactionForm.tsx`, a linha 3 já importa `useLanguage`:

```ts
// ANTES (linha 3):
import { useLanguage } from '../LanguageContext';
```

Substituir por:

```ts
// DEPOIS:
import { useLanguage } from '../LanguageContext';
import { useNotification } from '../NotificationContext';
```

- [ ] **Step 2: Adicionar o hook dentro do componente**

Localizar a linha ~42, onde `useLanguage` é desestruturado:

```ts
// ANTES (linha ~42):
  const { t, formatCurrency, locale } = useLanguage();
```

Adicionar a linha seguinte logo abaixo:

```ts
// DEPOIS:
  const { t, formatCurrency, locale } = useLanguage();
  const { showNotification } = useNotification();
```

- [ ] **Step 3: Substituir o return silencioso por notificação de erro**

Localizar as linhas 219–221:

```ts
// ANTES (linhas 219–221):
    if (isTransfer && (!accountId || !transferToAccountId)) {
      return;
    }
```

Substituir por:

```ts
// DEPOIS:
    if (isTransfer && (!accountId || !transferToAccountId)) {
      showNotification('Selecione a conta de origem e de destino para a transferência.', 'error');
      return;
    }
```

- [ ] **Step 4: Commitar**

```bash
git add Front-end/components/TransactionForm.tsx
git commit -m "fix: show error notification when transfer accounts are missing on submit"
```

Saída esperada: `1 file changed, 3 insertions(+), 1 deletion(-)`

---

## Verificação Final

- [ ] **Checar que todos os 4 commits foram criados:**

```bash
git log --oneline -5
```

Esperado: os 4 commits de fix aparecem no topo.

- [ ] **Build sem erros de TypeScript:**

```bash
cd Front-end && npm run build 2>&1 | tail -20
```

Esperado: `built in Xs` sem erros de tipo.

- [ ] **Teste manual — gráfico:**

  1. Criar uma transferência entre contas
  2. Abrir o Dashboard → aba Resumo → gráfico "Evolução do Saldo"
  3. Confirmar: **nenhuma barra vermelha** aparece para a transferência
  4. Confirmar: a linha de saldo **não cai** no ponto da transferência

- [ ] **Teste manual — série:**

  1. Criar despesa parcelada em 3x com contas diferentes em cada parcela
  2. Abrir a parcela do meio → editar descrição → salvar "série inteira"
  3. Confirmar: as outras parcelas preservam suas contas originais

- [ ] **Teste manual — form:**

  1. Criar nova transação → selecionar tipo "Transferir"
  2. Selecionar apenas a conta de origem (deixar destino em branco)
  3. Clicar em Salvar
  4. Confirmar: **notificação de erro** aparece em vez de submit silencioso
