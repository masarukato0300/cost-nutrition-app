-- パティスリー経営ナビ: 棚卸し入力方法設定テーブル
-- Supabase SQL Editorで実行してください。
-- 品目ごとの「数える・量る / 納品単位」切替設定だけを保存します。

create table if not exists public.inventory_input_settings (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  item_type text not null check (item_type in ('INGREDIENT', 'PRODUCT')),
  item_id text not null,
  input_mode text not null default 'actual_quantity' check (input_mode in ('actual_quantity', 'package_fraction')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_input_settings_store_item_idx
  on public.inventory_input_settings(store_id, item_type, item_id);

alter table public.inventory_input_settings enable row level security;

drop policy if exists tenant_select on public.inventory_input_settings;
drop policy if exists tenant_insert on public.inventory_input_settings;
drop policy if exists tenant_update on public.inventory_input_settings;
drop policy if exists tenant_delete on public.inventory_input_settings;
drop policy if exists store_rows_select on public.inventory_input_settings;
drop policy if exists store_rows_insert on public.inventory_input_settings;
drop policy if exists store_rows_update on public.inventory_input_settings;
drop policy if exists store_rows_delete on public.inventory_input_settings;
drop policy if exists "store_rows_select" on public.inventory_input_settings;
drop policy if exists "store_rows_insert" on public.inventory_input_settings;
drop policy if exists "store_rows_update" on public.inventory_input_settings;
drop policy if exists "store_rows_delete" on public.inventory_input_settings;

create policy store_rows_select on public.inventory_input_settings
for select using (public.user_has_store_access(store_id));

create policy store_rows_insert on public.inventory_input_settings
for insert with check (public.user_has_store_access(store_id));

create policy store_rows_update on public.inventory_input_settings
for update using (public.user_has_store_access(store_id))
with check (public.user_has_store_access(store_id));

create policy store_rows_delete on public.inventory_input_settings
for delete using (public.user_has_store_access(store_id));

grant select, insert, update, delete on public.inventory_input_settings to authenticated;
revoke all on public.inventory_input_settings from anon;

select
  'inventory_input_settings ready' as status,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'inventory_input_settings';
