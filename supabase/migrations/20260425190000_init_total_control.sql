create extension if not exists pgcrypto;

create or replace function public.set_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'user' check (role in ('admin', 'user')),
  status text not null default 'active' check (status in ('active')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  used_at timestamptz,
  used_by_user_id uuid references public.profiles (id) on delete set null
);

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  description text not null,
  amount double precision not null,
  type text not null check (type in ('income', 'expense')),
  category_key text not null,
  transaction_date timestamptz not null,
  schedule_type text not null default 'once' check (schedule_type in ('once', 'recurring', 'installment')),
  series_id text,
  installment_index integer,
  installment_count integer,
  is_recurring boolean not null default false,
  due_date timestamptz,
  is_paid boolean not null default false,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_transactions_user_date on public.transactions (user_id, transaction_date desc);
create index if not exists idx_transactions_due_date on public.transactions (user_id, due_date);
create index if not exists idx_transactions_paid on public.transactions (user_id, is_paid);

create table if not exists public.custom_categories (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  name text not null,
  color text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint custom_categories_user_key_unique unique (user_id, key)
);

create table if not exists public.brand_settings (
  id integer primary key,
  product_name text not null,
  logo_url text,
  favicon_url text,
  primary_color text not null,
  accent_color text not null,
  surface_color text not null,
  text_color text not null,
  support_email text,
  marketing_headline text not null
);

create table if not exists public.app_settings (
  id integer primary key,
  currency text not null check (currency in ('BRL', 'USD')),
  locale text not null check (locale in ('pt-BR', 'en-US')),
  timezone text not null,
  billing_day_default integer not null check (billing_day_default between 1 and 31)
);

create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1), 'User'),
    coalesce(new.email, ''),
    'user',
    'active'
  )
  on conflict (id) do update
    set
      name = excluded.name,
      email = excluded.email,
      updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_auth_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

drop trigger if exists profiles_set_timestamp on public.profiles;
create trigger profiles_set_timestamp
before update on public.profiles
for each row execute procedure public.set_timestamp();

drop trigger if exists transactions_set_timestamp on public.transactions;
create trigger transactions_set_timestamp
before update on public.transactions
for each row execute procedure public.set_timestamp();

insert into public.brand_settings (
  id,
  product_name,
  logo_url,
  favicon_url,
  primary_color,
  accent_color,
  surface_color,
  text_color,
  support_email,
  marketing_headline
)
values (
  1,
  'Total Control',
  null,
  null,
  '#275df5',
  '#5c7cfa',
  '#f7f8fa',
  '#1f2937',
  'support@example.com',
  'Controle financeiro simples, seguro e pronto para venda.'
)
on conflict (id) do nothing;

insert into public.app_settings (
  id,
  currency,
  locale,
  timezone,
  billing_day_default
)
values (
  1,
  'BRL',
  'pt-BR',
  'America/Sao_Paulo',
  5
)
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.transactions enable row level security;
alter table public.custom_categories enable row level security;
alter table public.brand_settings enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "transactions_manage_own" on public.transactions;
create policy "transactions_manage_own"
on public.transactions
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "custom_categories_manage_own" on public.custom_categories;
create policy "custom_categories_manage_own"
on public.custom_categories
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "brand_settings_public_read" on public.brand_settings;
create policy "brand_settings_public_read"
on public.brand_settings
for select
to anon, authenticated
using (true);

drop policy if exists "brand_settings_admin_update" on public.brand_settings;
create policy "brand_settings_admin_update"
on public.brand_settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "brand_settings_admin_insert" on public.brand_settings;
create policy "brand_settings_admin_insert"
on public.brand_settings
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "app_settings_authenticated_read" on public.app_settings;
create policy "app_settings_authenticated_read"
on public.app_settings
for select
to authenticated
using (true);

drop policy if exists "app_settings_admin_update" on public.app_settings;
create policy "app_settings_admin_update"
on public.app_settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "app_settings_admin_insert" on public.app_settings;
create policy "app_settings_admin_insert"
on public.app_settings
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "invites_admin_manage" on public.invites;
create policy "invites_admin_manage"
on public.invites
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
