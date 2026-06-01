-- パティスリー経営ナビ AI経営判断機能 本番RLSスキーマ
-- すべて shop_id で店舗分離します。
-- ブラウザからは anon key のみを使い、OpenAI APIキーと service_role key はサーバー側だけで使います。

create extension if not exists pgcrypto;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'trial' check (plan in ('trial', 'free', 'standard', 'pro', 'setup_support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'manager', 'staff', 'viewer')),
  created_at timestamptz not null default now(),
  unique (shop_id, user_id)
);

create table if not exists public.ingredients (
  id text primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  unit text not null default 'g',
  purchase_price numeric not null default 0,
  supplier text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingredient_price_history (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  ingredient_id text,
  price numeric not null default 0,
  effective_from date not null default current_date,
  memo text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  category text not null default '未分類',
  selling_price numeric not null default 0,
  current_cost numeric not null default 0,
  cost_rate numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id text,
  name text not null,
  yield_quantity numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete cascade,
  ingredient_id text,
  amount numeric not null default 0,
  unit text not null default 'g',
  cost numeric not null default 0
);

create table if not exists public.product_cost_history (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id text,
  cost numeric not null default 0,
  selling_price numeric not null default 0,
  cost_rate numeric not null default 0,
  effective_from date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_imports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  file_name text not null,
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  status text not null default 'imported',
  row_count integer not null default 0
);

create table if not exists public.sales_rows (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
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
  shop_id uuid not null references public.shops(id) on delete cascade,
  source_name text not null,
  column_mapping_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_name_mappings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  raw_product_name text not null,
  product_id text,
  confidence numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, raw_product_name)
);

create table if not exists public.waste_records (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id text,
  date date not null default current_date,
  quantity numeric not null default 0,
  reason text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.management_diagnosis_answers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  diagnosis_session_id uuid not null,
  question_key text not null,
  answer_text text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.management_diagnosis_results (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
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
  shop_id uuid not null references public.shops(id) on delete cascade,
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
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text not null default '',
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

-- 既存の開発用テーブルがある場合、create table if not exists だけでは列が追加されないため、
-- shop_id を後付けできるようにします。既存データのshop_id移行は別途実行してください。
alter table if exists public.ingredients add column if not exists shop_id uuid references public.shops(id) on delete cascade;
alter table if exists public.products add column if not exists shop_id uuid references public.shops(id) on delete cascade;
alter table if exists public.recipe_items add column if not exists shop_id uuid references public.shops(id) on delete cascade;
alter table if exists public.price_histories add column if not exists shop_id uuid references public.shops(id) on delete cascade;
alter table if exists public.waste_records add column if not exists shop_id uuid references public.shops(id) on delete cascade;
alter table if exists public.sales_records add column if not exists shop_id uuid references public.shops(id) on delete cascade;
alter table if exists public.actual_cost_records add column if not exists shop_id uuid references public.shops(id) on delete cascade;
alter table if exists public.event_plans add column if not exists shop_id uuid references public.shops(id) on delete cascade;
alter table if exists public.event_plan_items add column if not exists shop_id uuid references public.shops(id) on delete cascade;
alter table if exists public.labor_costs add column if not exists shop_id uuid references public.shops(id) on delete cascade;
alter table if exists public.set_product_items add column if not exists shop_id uuid references public.shops(id) on delete cascade;

create or replace function public.current_user_shop_ids()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select shop_id
  from public.shop_members
  where user_id = auth.uid()
$$;

create or replace function public.is_shop_member(target_shop_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_members
    where user_id = auth.uid()
      and shop_id = target_shop_id
  )
$$;

create or replace function public.has_shop_role(target_shop_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_members
    where user_id = auth.uid()
      and shop_id = target_shop_id
      and role = any(allowed_roles)
  )
$$;

alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_price_history enable row level security;
alter table public.products enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.product_cost_history enable row level security;
alter table public.sales_imports enable row level security;
alter table public.sales_rows enable row level security;
alter table public.csv_mapping_rules enable row level security;
alter table public.product_name_mappings enable row level security;
alter table public.waste_records enable row level security;
alter table public.management_diagnosis_answers enable row level security;
alter table public.management_diagnosis_results enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists shops_select_member on public.shops;
create policy shops_select_member on public.shops
for select using (public.is_shop_member(id));

drop policy if exists shops_insert_authenticated on public.shops;
create policy shops_insert_authenticated on public.shops
for insert with check (auth.uid() is not null);

drop policy if exists shops_update_owner_manager on public.shops;
create policy shops_update_owner_manager on public.shops
for update using (public.has_shop_role(id, array['owner','manager']))
with check (public.has_shop_role(id, array['owner','manager']));

drop policy if exists shop_members_select_same_shop on public.shop_members;
create policy shop_members_select_same_shop on public.shop_members
for select using (public.is_shop_member(shop_id) or user_id = auth.uid());

drop policy if exists shop_members_insert_owner on public.shop_members;
create policy shop_members_insert_owner on public.shop_members
for insert with check (user_id = auth.uid() or public.has_shop_role(shop_id, array['owner']));

drop policy if exists shop_members_update_owner on public.shop_members;
create policy shop_members_update_owner on public.shop_members
for update using (public.has_shop_role(shop_id, array['owner']))
with check (public.has_shop_role(shop_id, array['owner']));

drop policy if exists shop_members_delete_owner on public.shop_members;
create policy shop_members_delete_owner on public.shop_members
for delete using (public.has_shop_role(shop_id, array['owner']));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'ingredients',
    'ingredient_price_history',
    'products',
    'recipes',
    'recipe_items',
    'product_cost_history',
    'sales_imports',
    'sales_rows',
    'csv_mapping_rules',
    'product_name_mappings',
    'waste_records',
    'management_diagnosis_answers',
    'management_diagnosis_results',
    'ai_usage_logs',
    'audit_logs'
  ]
  loop
    execute format('drop policy if exists tenant_select on public.%I', table_name);
    execute format('drop policy if exists tenant_insert on public.%I', table_name);
    execute format('drop policy if exists tenant_update on public.%I', table_name);
    execute format('drop policy if exists tenant_delete on public.%I', table_name);
    execute format('create policy tenant_select on public.%I for select using (public.is_shop_member(shop_id))', table_name);
    execute format('create policy tenant_insert on public.%I for insert with check (public.is_shop_member(shop_id))', table_name);
    execute format('create policy tenant_update on public.%I for update using (public.has_shop_role(shop_id, array[''owner'',''manager'',''staff''])) with check (public.has_shop_role(shop_id, array[''owner'',''manager'',''staff'']))', table_name);
    execute format('create policy tenant_delete on public.%I for delete using (public.has_shop_role(shop_id, array[''owner'',''manager'']))', table_name);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
