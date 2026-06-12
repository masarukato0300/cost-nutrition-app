-- パティスリー経営ナビ: 包材自動判定・ユーザー修正保存テーブル
-- Supabase SQL Editorで実行してください。
-- 包材分類の保存先だけを追加し、既存店舗データには触れません。

create table if not exists public.packaging_classifications (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  ingredient_id text not null,
  packaging_role text not null default '通常包材',
  brand_importance text not null default '低',
  year_round_usage text not null default '不明',
  usage_category text not null default 'その他',
  confidence numeric not null default 0,
  reason text not null default '',
  source text not null default 'auto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists packaging_classifications_store_ingredient_idx
  on public.packaging_classifications(store_id, ingredient_id);

alter table public.packaging_classifications enable row level security;

drop policy if exists tenant_select on public.packaging_classifications;
drop policy if exists tenant_insert on public.packaging_classifications;
drop policy if exists tenant_update on public.packaging_classifications;
drop policy if exists tenant_delete on public.packaging_classifications;
drop policy if exists store_rows_select on public.packaging_classifications;
drop policy if exists store_rows_insert on public.packaging_classifications;
drop policy if exists store_rows_update on public.packaging_classifications;
drop policy if exists store_rows_delete on public.packaging_classifications;
drop policy if exists "store_rows_select" on public.packaging_classifications;
drop policy if exists "store_rows_insert" on public.packaging_classifications;
drop policy if exists "store_rows_update" on public.packaging_classifications;
drop policy if exists "store_rows_delete" on public.packaging_classifications;

create policy store_rows_select on public.packaging_classifications
for select using (public.user_has_store_access(store_id));

create policy store_rows_insert on public.packaging_classifications
for insert with check (public.user_has_store_access(store_id));

create policy store_rows_update on public.packaging_classifications
for update using (public.user_has_store_access(store_id))
with check (public.user_has_store_access(store_id));

create policy store_rows_delete on public.packaging_classifications
for delete using (public.user_has_store_access(store_id));

grant select, insert, update, delete on public.packaging_classifications to authenticated;
revoke all on public.packaging_classifications from anon;

select
  'packaging_classifications ready' as status,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'packaging_classifications';
