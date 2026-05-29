-- ── Tabela de contas bancárias ──────────────────────────────────────────────
create table if not exists public.accounts (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles (id) on delete cascade,
  name         text        not null,
  bank         text,
  account_type text        not null default 'checking'
                           check (account_type in ('checking','savings','credit_card','investment','cash')),
  initial_balance double precision not null default 0,
  color        text        not null default '#3B82F6',
  icon         text        not null default 'bank',
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now())
);

alter table public.accounts enable row level security;

create policy "users_manage_own_accounts"
  on public.accounts for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger set_accounts_timestamp
  before update on public.accounts
  for each row execute function public.set_timestamp();

-- ── Vínculo opcional na tabela de transações ─────────────────────────────────
alter table public.transactions
  add column if not exists account_id uuid references public.accounts (id) on delete set null;

create index if not exists idx_transactions_account_id on public.transactions (account_id);
