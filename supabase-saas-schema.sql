create extension if not exists pgcrypto;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
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

create table if not exists public.product_categories (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingredients (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  type text not null,
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
  support_status text not null default 'disabled' check (support_status in ('active', 'expired', 'disabled')),
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

create index if not exists inventory_records_store_month_idx on public.inventory_records(store_id, month);
create index if not exists inventory_records_store_date_idx on public.inventory_records(store_id, date);

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

create table if not exists public.support_access_logs (
  id uuid primary key default gen_random_uuid(),
  support_user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  action text not null,
  memo text not null default '',
  created_at timestamptz not null default now()
);

alter table public.stores enable row level security;
alter table public.user_profiles enable row level security;
alter table public.product_categories enable row level security;
alter table public.ingredients enable row level security;
alter table public.products enable row level security;
alter table public.recipe_items enable row level security;
alter table public.price_histories enable row level security;
alter table public.ingredient_aliases enable row level security;
alter table public.onboarding_support_settings enable row level security;
alter table public.billing_settings enable row level security;
alter table public.waste_records enable row level security;
alter table public.sales_records enable row level security;
alter table public.actual_cost_records enable row level security;
alter table public.inventory_records enable row level security;
alter table public.event_plans enable row level security;
alter table public.event_plan_items enable row level security;
alter table public.labor_costs enable row level security;
alter table public.set_product_items enable row level security;
alter table public.ocr_documents enable row level security;
alter table public.ocr_extracted_items enable row level security;
alter table public.support_access_logs enable row level security;

create or replace function public.user_has_store_access(target_store_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where user_id = auth.uid()
      and store_id = target_store_id
  );
$$;

drop policy if exists "stores_select_own" on public.stores;
drop policy if exists "stores_insert_own" on public.stores;
drop policy if exists "stores_update_own" on public.stores;
drop policy if exists "profiles_select_own" on public.user_profiles;
drop policy if exists "profiles_insert_own" on public.user_profiles;
drop policy if exists "profiles_update_own" on public.user_profiles;

create policy "stores_select_own" on public.stores for select using (
  owner_user_id = auth.uid() or public.user_has_store_access(id)
);
create policy "stores_insert_own" on public.stores for insert with check (owner_user_id = auth.uid());
create policy "stores_update_own" on public.stores for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "profiles_select_own" on public.user_profiles for select using (user_id = auth.uid());
create policy "profiles_insert_own" on public.user_profiles for insert with check (user_id = auth.uid());
create policy "profiles_update_own" on public.user_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "store_rows_select" on public.product_categories;
drop policy if exists "store_rows_insert" on public.product_categories;
drop policy if exists "store_rows_update" on public.product_categories;
drop policy if exists "store_rows_delete" on public.product_categories;
drop policy if exists "store_rows_select" on public.ingredients;
drop policy if exists "store_rows_insert" on public.ingredients;
drop policy if exists "store_rows_update" on public.ingredients;
drop policy if exists "store_rows_delete" on public.ingredients;
drop policy if exists "store_rows_select" on public.products;
drop policy if exists "store_rows_insert" on public.products;
drop policy if exists "store_rows_update" on public.products;
drop policy if exists "store_rows_delete" on public.products;
drop policy if exists "store_rows_select" on public.recipe_items;
drop policy if exists "store_rows_insert" on public.recipe_items;
drop policy if exists "store_rows_update" on public.recipe_items;
drop policy if exists "store_rows_delete" on public.recipe_items;
drop policy if exists "store_rows_select" on public.price_histories;
drop policy if exists "store_rows_insert" on public.price_histories;
drop policy if exists "store_rows_update" on public.price_histories;
drop policy if exists "store_rows_delete" on public.price_histories;

create policy "store_rows_select" on public.product_categories for select using (public.user_has_store_access(store_id));
create policy "store_rows_insert" on public.product_categories for insert with check (public.user_has_store_access(store_id));
create policy "store_rows_update" on public.product_categories for update using (public.user_has_store_access(store_id)) with check (public.user_has_store_access(store_id));
create policy "store_rows_delete" on public.product_categories for delete using (public.user_has_store_access(store_id));

create policy "store_rows_select" on public.ingredients for select using (public.user_has_store_access(store_id));
create policy "store_rows_insert" on public.ingredients for insert with check (public.user_has_store_access(store_id));
create policy "store_rows_update" on public.ingredients for update using (public.user_has_store_access(store_id)) with check (public.user_has_store_access(store_id));
create policy "store_rows_delete" on public.ingredients for delete using (public.user_has_store_access(store_id));

create policy "store_rows_select" on public.products for select using (public.user_has_store_access(store_id));
create policy "store_rows_insert" on public.products for insert with check (public.user_has_store_access(store_id));
create policy "store_rows_update" on public.products for update using (public.user_has_store_access(store_id)) with check (public.user_has_store_access(store_id));
create policy "store_rows_delete" on public.products for delete using (public.user_has_store_access(store_id));

create policy "store_rows_select" on public.recipe_items for select using (public.user_has_store_access(store_id));
create policy "store_rows_insert" on public.recipe_items for insert with check (public.user_has_store_access(store_id));
create policy "store_rows_update" on public.recipe_items for update using (public.user_has_store_access(store_id)) with check (public.user_has_store_access(store_id));
create policy "store_rows_delete" on public.recipe_items for delete using (public.user_has_store_access(store_id));

create policy "store_rows_select" on public.price_histories for select using (public.user_has_store_access(store_id));
create policy "store_rows_insert" on public.price_histories for insert with check (public.user_has_store_access(store_id));
create policy "store_rows_update" on public.price_histories for update using (public.user_has_store_access(store_id)) with check (public.user_has_store_access(store_id));
create policy "store_rows_delete" on public.price_histories for delete using (public.user_has_store_access(store_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
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
    'ocr_extracted_items'
  ]
  loop
    execute format('drop policy if exists store_rows_select on public.%I', table_name);
    execute format('drop policy if exists store_rows_insert on public.%I', table_name);
    execute format('drop policy if exists store_rows_update on public.%I', table_name);
    execute format('drop policy if exists store_rows_delete on public.%I', table_name);
    execute format('create policy store_rows_select on public.%I for select using (public.user_has_store_access(store_id))', table_name);
    execute format('create policy store_rows_insert on public.%I for insert with check (public.user_has_store_access(store_id))', table_name);
    execute format('create policy store_rows_update on public.%I for update using (public.user_has_store_access(store_id)) with check (public.user_has_store_access(store_id))', table_name);
    execute format('create policy store_rows_delete on public.%I for delete using (public.user_has_store_access(store_id))', table_name);
  end loop;
end $$;
