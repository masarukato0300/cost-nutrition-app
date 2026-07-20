create extension if not exists pgcrypto;

alter table if exists public.billing_settings
  add column if not exists billing_period_start date,
  add column if not exists renewal_anchor_day integer,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'billing_settings'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'billing_settings_store_id_key'
  ) then
    alter table public.billing_settings
      add constraint billing_settings_store_id_key unique (store_id);
  end if;
end $$;

create table if not exists public.ocr_usage_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  billing_month text not null,
  image_name text,
  status text not null default 'success',
  used_count_after integer,
  created_at timestamptz not null default now()
);

create table if not exists public.ocr_addon_purchases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  billing_month text not null,
  added_ocr_count integer not null,
  price integer not null,
  payment_provider text not null default 'manual_invoice',
  payment_status text not null default 'invoice_pending',
  stripe_payment_id text,
  memo text,
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ocr_usage_events enable row level security;
alter table public.ocr_addon_purchases enable row level security;

drop policy if exists "ocr_usage_events_select_own_store" on public.ocr_usage_events;
drop policy if exists "ocr_usage_events_insert_own_store" on public.ocr_usage_events;
drop policy if exists "ocr_usage_events_update_own_store" on public.ocr_usage_events;
drop policy if exists "ocr_usage_events_delete_own_store" on public.ocr_usage_events;

create policy "ocr_usage_events_select_own_store"
on public.ocr_usage_events
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.user_id = (select auth.uid())
      and up.store_id = ocr_usage_events.store_id
  )
);

create policy "ocr_usage_events_insert_own_store"
on public.ocr_usage_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.user_id = (select auth.uid())
      and up.store_id = ocr_usage_events.store_id
      and up.role in ('owner', 'manager', 'staff')
  )
);

drop policy if exists "ocr_addon_purchases_select_own_store" on public.ocr_addon_purchases;
drop policy if exists "ocr_addon_purchases_insert_own_store" on public.ocr_addon_purchases;
drop policy if exists "ocr_addon_purchases_update_own_store" on public.ocr_addon_purchases;
drop policy if exists "ocr_addon_purchases_delete_own_store" on public.ocr_addon_purchases;

create policy "ocr_addon_purchases_select_own_store"
on public.ocr_addon_purchases
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.user_id = (select auth.uid())
      and up.store_id = ocr_addon_purchases.store_id
  )
);

create policy "ocr_addon_purchases_insert_own_store"
on public.ocr_addon_purchases
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.user_id = (select auth.uid())
      and up.store_id = ocr_addon_purchases.store_id
      and up.role in ('owner', 'manager')
  )
);

create policy "ocr_addon_purchases_update_own_store"
on public.ocr_addon_purchases
for update
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.user_id = (select auth.uid())
      and up.store_id = ocr_addon_purchases.store_id
      and up.role in ('owner', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.user_id = (select auth.uid())
      and up.store_id = ocr_addon_purchases.store_id
      and up.role in ('owner', 'manager')
  )
);

grant select, insert on public.ocr_usage_events to authenticated;
grant select, insert, update on public.ocr_addon_purchases to authenticated;

select
  'ocr_billing_tables_ready' as status,
  t.tablename,
  t.rowsecurity
from pg_tables t
where t.schemaname = 'public'
  and t.tablename in ('ocr_usage_events', 'ocr_addon_purchases');
