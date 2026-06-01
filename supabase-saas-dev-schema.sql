-- パティスリー経営ナビ SaaS開発確認用スキーマ
-- まずログイン・保存確認を通すためのSQLです。
-- 本番販売前には、下部のRLS方針に沿って店舗ごとのRLSポリシーを有効化してください。

create extension if not exists pgcrypto;

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

-- 現在のコードでは商品カテゴリを product_categories として保存します。
create table if not exists public.product_categories (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 将来用の汎用カテゴリ。現コードはまだ直接使いません。
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  category_type text not null default 'product',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingredients (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  type text not null default 'PURCHASED_INGREDIENT',
  category text not null default '未分類',
  supplier text not null default '',
  package_name text not null default '',
  package_amount_gram numeric not null default 0,
  package_unit text not null default 'g',
  gram_per_unit numeric not null default 1,
  price numeric not null default 0,
  tax_type text not null default '税抜',
  calories_per100g numeric,
  protein_per100g numeric,
  fat_per100g numeric,
  carbs_per100g numeric,
  salt_per100g numeric,
  allergens jsonb not null default '[]'::jsonb,
  other_allergen text not null default '',
  label_name text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  is_intermediate_material boolean not null default false,
  category text not null default '未分類',
  selling_price numeric not null default 0,
  tax_type text not null default '税込',
  target_cost_rate numeric not null default 35,
  display_unit text not null default '1個あたり',
  yield_count numeric not null default 1,
  before_bake_weight_gram numeric not null default 0,
  after_bake_weight_gram numeric,
  weight_per_piece_gram numeric not null default 0,
  status text not null default '販売中',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_items (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id text not null,
  ingredient_id text not null default '',
  item_type text not null default 'ingredient',
  intermediate_product_id text not null default '',
  usage_type text not null default 'gram',
  amount_gram numeric not null default 0,
  base_amount_gram numeric not null default 0,
  used_count numeric not null default 1,
  total_count numeric not null default 1,
  fraction_denominator numeric not null default 1,
  loss_rate numeric not null default 0,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 現コードでは包材も ingredients.type = 'PACKAGING' として保存します。
-- 将来用に専用テーブルも作成しておきます。
create table if not exists public.packaging_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  supplier text not null default '',
  package_amount numeric not null default 0,
  package_unit text not null default '個',
  price numeric not null default 0,
  unit_price numeric not null default 0,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_histories (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  ingredient_id text not null,
  old_price numeric not null default 0,
  new_price numeric not null default 0,
  changed_at timestamptz not null default now(),
  supplier text not null default '',
  reason text not null default '',
  source_type text not null default 'manual',
  memo text not null default ''
);

create table if not exists public.ingredient_aliases (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  source_text text not null default '',
  normalized_source_text text not null default '',
  name text not null default '',
  package_name text not null default '',
  supplier text not null default '',
  category text not null default '',
  label_name text not null default '',
  calories_per100g numeric,
  protein_per100g numeric,
  fat_per100g numeric,
  carbs_per100g numeric,
  salt_per100g numeric,
  use_count numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_support_settings (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  enabled boolean not null default false,
  official_line_url text not null default '',
  support_start_date date,
  support_end_date date,
  support_status text not null default 'disabled',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_settings (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  ocr_used_month text not null default '',
  ocr_used_this_month numeric not null default 0,
  base_monthly_price numeric not null default 1400,
  ocr_base_limit numeric not null default 30,
  ocr_addon_packs numeric not null default 0,
  ocr_addon_pack_size numeric not null default 50,
  ocr_addon_price numeric not null default 500,
  ocr_addon_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.waste_records (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null,
  item_type text not null,
  item_id text not null,
  quantity numeric not null default 0,
  cost_amount numeric not null default 0,
  sales_equivalent_amount numeric not null default 0,
  reason text not null default '売れ残り',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_records (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  month text not null,
  product_id text not null,
  quantity numeric not null default 0,
  selling_price numeric not null default 0,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.actual_cost_records (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  month text not null,
  supplier text not null default '',
  amount numeric not null default 0,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_plans (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  date date not null,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_plan_items (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  event_plan_id text not null,
  product_id text not null,
  planned_quantity numeric not null default 0,
  selling_price numeric not null default 0,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.labor_costs (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id text not null,
  process_name text not null default '',
  minutes numeric not null default 0,
  workers numeric not null default 1,
  hourly_wage numeric not null default 0,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.set_product_items (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  set_product_id text not null,
  child_product_id text not null,
  quantity numeric not null default 1,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ocr_documents (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  file_name text not null default '',
  file_path text not null default '',
  supplier_name text not null default '',
  document_type text not null default 'price_revision',
  status text not null default 'uploaded',
  raw_text text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ocr_extracted_items (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  document_id text not null,
  raw_ingredient_name text not null default '',
  raw_package_name text not null default '',
  raw_old_price text not null default '',
  raw_new_price text not null default '',
  parsed_old_price numeric,
  parsed_new_price numeric,
  confidence numeric,
  matched_ingredient_id text,
  status text not null default 'pending',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 開発確認中はRLSを一旦OFFにします。
-- ログイン・新規登録・保存確認が終わったら、本番用RLSをONにしてください。
alter table public.stores disable row level security;
alter table public.user_profiles disable row level security;
alter table public.product_categories disable row level security;
alter table public.categories disable row level security;
alter table public.ingredients disable row level security;
alter table public.products disable row level security;
alter table public.recipe_items disable row level security;
alter table public.packaging_items disable row level security;
alter table public.price_histories disable row level security;
alter table public.ingredient_aliases disable row level security;
alter table public.onboarding_support_settings disable row level security;
alter table public.billing_settings disable row level security;
alter table public.waste_records disable row level security;
alter table public.sales_records disable row level security;
alter table public.actual_cost_records disable row level security;
alter table public.event_plans disable row level security;
alter table public.event_plan_items disable row level security;
alter table public.labor_costs disable row level security;
alter table public.set_product_items disable row level security;
alter table public.ocr_documents disable row level security;
alter table public.ocr_extracted_items disable row level security;

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- ログイン成功確認後の本番RLS方針:
-- 1. 全テーブルで RLS を enable
-- 2. stores は owner_user_id = auth.uid() の行だけ許可
-- 3. user_profiles は user_id = auth.uid() の行だけ許可
-- 4. 業務テーブルは store_id がログインユーザーの user_profiles.store_id と一致する場合だけ許可
