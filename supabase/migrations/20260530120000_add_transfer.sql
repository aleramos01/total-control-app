-- ── Suporte a transferências entre contas ────────────────────────────────────
-- Quando transfer_to_account_id está preenchido, a transação é uma transferência:
--   account_id            → conta de origem  (saldo diminui)
--   transfer_to_account_id → conta de destino (saldo aumenta)
-- O campo type permanece 'expense', mas transferências são excluídas dos totais
-- de receitas/despesas (neutras para o patrimônio líquido).

alter table public.transactions
  add column if not exists transfer_to_account_id uuid
    references public.accounts (id) on delete set null;

create index if not exists idx_transactions_transfer_to_account_id
  on public.transactions (transfer_to_account_id);
