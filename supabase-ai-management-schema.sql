-- パティスリー経営ナビ AI経営判断機能 本番RLSスキーマ
-- 販売版ログインに合わせて、すべて store_id で店舗分離します。
-- ブラウザからは anon key のみを使い、OpenAI APIキーと service_role key はサーバー側だけで使います。

create extension if not exists pgcrypto;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  plan text not null default 'trial' check (plan in ('trial', 'free', 'standard', 'pro', 'setup_support')),
  subscription_status text not null default 'trialing' check (subscription_status in ('active', 'trialing', 'past_due', 'canceled', 'suspended')),
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null default '',
  role text not null default 'owner' check (role in ('owner', 'manager', 'staff', 'support_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id)
);

create table if not exists public.ingredients (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
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
  label_name text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  category text not null default '未分類',
  selling_price numeric not null default 0,
  target_cost_rate numeric not null default 35,
  yield_count numeric not null default 1,
  status text not null default '販売中',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_items (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id text,
  ingredient_id text,
  amount_gram numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_histories (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  ingredient_id text,
  old_price numeric not null default 0,
  new_price numeric not null default 0,
  changed_at timestamptz not null default now(),
  supplier text not null default '',
  reason text not null default '',
  source_type text not null default 'manual',
  memo text not null default ''
);

create table if not exists public.product_cost_history (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id text,
  cost numeric not null default 0,
  selling_price numeric not null default 0,
  cost_rate numeric not null default 0,
  effective_from date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_imports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  file_name text not null,
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  status text not null default 'imported',
  row_count integer not null default 0
);

create table if not exists public.sales_rows (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  import_id uuid references public.sales_imports(id) on delete cascade,
  sold_at timestamptz not null,
  raw_product_name text not null,
  product_id text,
  quantity numeric not null default 0,
  sales_amount numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  payment_method text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.csv_mapping_rules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  source_name text not null,
  column_mapping_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_name_mappings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  raw_product_name text not null,
  product_id text,
  confidence numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, raw_product_name)
);

create table if not exists public.management_profiles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  business_styles jsonb not null default '[]'::jsonb,
  location_types jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id)
);

create table if not exists public.management_diagnosis_answers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  diagnosis_session_id uuid not null,
  question_key text not null,
  answer_text text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.management_external_factors (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null default current_date,
  factors jsonb not null default '{}'::jsonb,
  memo text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.management_diagnosis_results (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  diagnosis_session_id uuid not null,
  summary_json jsonb not null default '{}'::jsonb,
  swot_json jsonb not null default '{}'::jsonb,
  three_c_json jsonb not null default '{}'::jsonb,
  four_p_json jsonb not null default '{}'::jsonb,
  stp_json jsonb not null default '{}'::jsonb,
  seven_s_json jsonb not null default '{}'::jsonb,
  pest_json jsonb not null default '{}'::jsonb,
  tows_json jsonb not null default '{}'::jsonb,
  action_plan_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  feature_name text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text not null default '',
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

-- 既存テーブルが shop_id で作られていた場合も、今後の本番設計に合わせて store_id を追加します。
alter table if exists public.ingredients add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.products add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.recipe_items add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.price_histories add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.ingredient_aliases add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.product_categories add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.waste_records add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.sales_records add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.actual_cost_records add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.event_plans add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.event_plan_items add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.labor_costs add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.set_product_items add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.management_profiles add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.management_diagnosis_answers add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.management_external_factors add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.management_diagnosis_results add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.ai_usage_logs add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.audit_logs add column if not exists store_id uuid references public.stores(id) on delete cascade;

create or replace function public.user_has_store_access(target_store_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where user_id = auth.uid()
      and store_id = target_store_id
  )
$$;

create or replace function public.user_has_store_role(target_store_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where user_id = auth.uid()
      and store_id = target_store_id
      and role = any(allowed_roles)
  )
$$;

alter table public.stores enable row level security;
alter table public.user_profiles enable row level security;
alter table public.ingredients enable row level security;
alter table public.products enable row level security;
alter table public.recipe_items enable row level security;
alter table public.price_histories enable row level security;
alter table public.product_cost_history enable row level security;
alter table public.sales_imports enable row level security;
alter table public.sales_rows enable row level security;
alter table public.csv_mapping_rules enable row level security;
alter table public.product_name_mappings enable row level security;
alter table public.management_profiles enable row level security;
alter table public.management_diagnosis_answers enable row level security;
alter table public.management_external_factors enable row level security;
alter table public.management_diagnosis_results enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists stores_select_member on public.stores;
create policy stores_select_member on public.stores
for select using (public.user_has_store_access(id));

drop policy if exists stores_insert_owner on public.stores;
create policy stores_insert_owner on public.stores
for insert with check (auth.uid() is not null and owner_user_id = auth.uid());

drop policy if exists stores_update_owner_manager on public.stores;
create policy stores_update_owner_manager on public.stores
for update using (public.user_has_store_role(id, array['owner','manager']))
with check (public.user_has_store_role(id, array['owner','manager']));

drop policy if exists user_profiles_select_same_store on public.user_profiles;
create policy user_profiles_select_same_store on public.user_profiles
for select using (public.user_has_store_access(store_id) or user_id = auth.uid());

drop policy if exists user_profiles_insert_self on public.user_profiles;
create policy user_profiles_insert_self on public.user_profiles
for insert with check (user_id = auth.uid() or public.user_has_store_role(store_id, array['owner']));

drop policy if exists user_profiles_update_owner on public.user_profiles;
create policy user_profiles_update_owner on public.user_profiles
for update using (public.user_has_store_role(store_id, array['owner']))
with check (public.user_has_store_role(store_id, array['owner']));

drop policy if exists user_profiles_delete_owner on public.user_profiles;
create policy user_profiles_delete_owner on public.user_profiles
for delete using (public.user_has_store_role(store_id, array['owner']));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'ingredients',
    'products',
    'recipe_items',
    'price_histories',
    'product_cost_history',
    'sales_imports',
    'sales_rows',
    'csv_mapping_rules',
    'product_name_mappings',
    'management_profiles',
    'management_diagnosis_answers',
    'management_external_factors',
    'management_diagnosis_results',
    'ai_usage_logs',
    'audit_logs'
  ]
  loop
    execute format('drop policy if exists store_rows_select on public.%I', table_name);
    execute format('drop policy if exists store_rows_insert on public.%I', table_name);
    execute format('drop policy if exists store_rows_update on public.%I', table_name);
    execute format('drop policy if exists store_rows_delete on public.%I', table_name);
    execute format('drop policy if exists tenant_select on public.%I', table_name);
    execute format('drop policy if exists tenant_insert on public.%I', table_name);
    execute format('drop policy if exists tenant_update on public.%I', table_name);
    execute format('drop policy if exists tenant_delete on public.%I', table_name);
    execute format('create policy store_rows_select on public.%I for select using (public.user_has_store_access(store_id))', table_name);
    execute format('create policy store_rows_insert on public.%I for insert with check (public.user_has_store_access(store_id))', table_name);
    execute format('create policy store_rows_update on public.%I for update using (public.user_has_store_role(store_id, array[''owner'',''manager'',''staff''])) with check (public.user_has_store_role(store_id, array[''owner'',''manager'',''staff'']))', table_name);
    execute format('create policy store_rows_delete on public.%I for delete using (public.user_has_store_role(store_id, array[''owner'',''manager'']))', table_name);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
