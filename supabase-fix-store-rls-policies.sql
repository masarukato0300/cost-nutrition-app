-- パティスリー経営ナビ: store_id 用RLS修復SQL
-- エラー例:
-- new row violates row-level security policy for table "ingredients"
--
-- 原因:
-- AI経営判断用の shop_id RLS と、既存アプリ用の store_id RLS が混在すると、
-- ingredients などの保存時にRLSで弾かれることがあります。
--
-- 対応:
-- 既存アプリの主要テーブルを store_id でログインユーザーの店舗に限定します。
-- Supabase SQL Editorでこのファイル全体を実行してください。

create extension if not exists pgcrypto;

-- RLS判定に必要な基本テーブルです。未作成の場合は先に作ります。
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'trial',
  subscription_status text not null default 'trialing',
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null default '',
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id)
);

create or replace function public.user_has_store_access(target_store_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where user_profiles.user_id = auth.uid()
      and user_profiles.store_id = target_store_id
  );
$$;

alter table public.stores enable row level security;
alter table public.user_profiles enable row level security;

drop policy if exists "stores_select_own" on public.stores;
drop policy if exists "stores_insert_own" on public.stores;
drop policy if exists "stores_update_own" on public.stores;
drop policy if exists "profiles_select_own" on public.user_profiles;
drop policy if exists "profiles_insert_own" on public.user_profiles;
drop policy if exists "profiles_update_own" on public.user_profiles;

create policy "stores_select_own" on public.stores
for select
using (
  owner_user_id = auth.uid()
  or public.user_has_store_access(id)
);

create policy "stores_insert_own" on public.stores
for insert
with check (owner_user_id = auth.uid());

create policy "stores_update_own" on public.stores
for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "profiles_select_own" on public.user_profiles
for select
using (user_id = auth.uid());

create policy "profiles_insert_own" on public.user_profiles
for insert
with check (user_id = auth.uid());

create policy "profiles_update_own" on public.user_profiles
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'product_categories',
    'ingredients',
    'products',
    'recipe_items',
    'price_histories',
    'ingredient_aliases',
    'onboarding_support_settings',
    'billing_settings',
    'waste_records',
    'sales_records',
    'actual_cost_records',
    'inventory_records',
    'event_plans',
    'event_plan_items',
    'labor_costs',
    'set_product_items',
    'ocr_documents',
    'ocr_extracted_items',
    'packaging_items'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);

      -- AI経営判断用SQLで作られた shop_id 前提ポリシーがある場合は削除します。
      execute format('drop policy if exists tenant_select on public.%I', table_name);
      execute format('drop policy if exists tenant_insert on public.%I', table_name);
      execute format('drop policy if exists tenant_update on public.%I', table_name);
      execute format('drop policy if exists tenant_delete on public.%I', table_name);

      -- 既存アプリ用 store_id 前提ポリシーを作り直します。
      execute format('drop policy if exists store_rows_select on public.%I', table_name);
      execute format('drop policy if exists store_rows_insert on public.%I', table_name);
      execute format('drop policy if exists store_rows_update on public.%I', table_name);
      execute format('drop policy if exists store_rows_delete on public.%I', table_name);
      execute format('drop policy if exists "store_rows_select" on public.%I', table_name);
      execute format('drop policy if exists "store_rows_insert" on public.%I', table_name);
      execute format('drop policy if exists "store_rows_update" on public.%I', table_name);
      execute format('drop policy if exists "store_rows_delete" on public.%I', table_name);

      execute format(
        'create policy store_rows_select on public.%I for select using (public.user_has_store_access(store_id))',
        table_name
      );
      execute format(
        'create policy store_rows_insert on public.%I for insert with check (public.user_has_store_access(store_id))',
        table_name
      );
      execute format(
        'create policy store_rows_update on public.%I for update using (public.user_has_store_access(store_id)) with check (public.user_has_store_access(store_id))',
        table_name
      );
      execute format(
        'create policy store_rows_delete on public.%I for delete using (public.user_has_store_access(store_id))',
        table_name
      );
    end if;
  end loop;
end $$;
