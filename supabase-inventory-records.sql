-- パティスリー経営ナビ: 棚卸し記録テーブル
-- Supabase SQL Editorで実行してください。
-- 既存店舗データには触れず、棚卸し用の新規テーブルとRLSだけを追加します。

create table if not exists public.inventory_records (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null,
  month text not null,
  item_type text not null check (item_type in ('INGREDIENT', 'PRODUCT')),
  item_id text not null,
  category_name text not null default '',
  item_name text not null default '',
  quantity numeric not null default 0,
  unit_label text not null default '',
  unit_cost numeric not null default 0,
  amount numeric not null default 0,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_records_store_month_idx
  on public.inventory_records(store_id, month);

create index if not exists inventory_records_store_date_idx
  on public.inventory_records(store_id, date);

alter table public.inventory_records enable row level security;

drop policy if exists tenant_select on public.inventory_records;
drop policy if exists tenant_insert on public.inventory_records;
drop policy if exists tenant_update on public.inventory_records;
drop policy if exists tenant_delete on public.inventory_records;
drop policy if exists store_rows_select on public.inventory_records;
drop policy if exists store_rows_insert on public.inventory_records;
drop policy if exists store_rows_update on public.inventory_records;
drop policy if exists store_rows_delete on public.inventory_records;
drop policy if exists "store_rows_select" on public.inventory_records;
drop policy if exists "store_rows_insert" on public.inventory_records;
drop policy if exists "store_rows_update" on public.inventory_records;
drop policy if exists "store_rows_delete" on public.inventory_records;

create policy store_rows_select on public.inventory_records
for select using (public.user_has_store_access(store_id));

create policy store_rows_insert on public.inventory_records
for insert with check (public.user_has_store_access(store_id));

create policy store_rows_update on public.inventory_records
for update using (public.user_has_store_access(store_id))
with check (public.user_has_store_access(store_id));

create policy store_rows_delete on public.inventory_records
for delete using (public.user_has_store_access(store_id));

grant select, insert, update, delete on public.inventory_records to authenticated;
revoke all on public.inventory_records from anon;

select
  'inventory_records ready' as status,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'inventory_records';
