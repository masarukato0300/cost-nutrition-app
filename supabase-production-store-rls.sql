-- Production RLS hardening for パティスリー経営ナビ.
-- Goal: make store_id the primary tenant key and prevent anon access to business data.
-- This migration is intentionally non-destructive: it does not drop legacy shop_id columns.

create extension if not exists pgcrypto;

create table if not exists public.management_profiles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  business_styles jsonb not null default '[]'::jsonb,
  location_types jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.management_external_factors (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  date date not null default current_date,
  factors jsonb not null default '{}'::jsonb,
  memo text not null default '',
  created_at timestamptz not null default now()
);

alter table if exists public.management_diagnosis_answers add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.management_diagnosis_results add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.ai_usage_logs add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table if exists public.audit_logs add column if not exists store_id uuid references public.stores(id) on delete cascade;

create unique index if not exists management_profiles_store_id_key on public.management_profiles(store_id);

create or replace function public.user_has_store_access(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where store_id = target_store_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.user_has_store_role(target_store_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where store_id = target_store_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

revoke execute on function public.user_has_store_access(uuid) from public, anon;
revoke execute on function public.user_has_store_role(uuid, text[]) from public, anon;
grant execute on function public.user_has_store_access(uuid) to authenticated;
grant execute on function public.user_has_store_role(uuid, text[]) to authenticated;

-- Do not let anonymous clients read or write business tables directly.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant usage on schema public to anon, authenticated;

-- Authenticated clients still need table privileges; RLS below limits rows by store_id.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table public.stores enable row level security;
alter table public.user_profiles enable row level security;

drop policy if exists stores_select_member on public.stores;
drop policy if exists stores_insert_owner on public.stores;
drop policy if exists stores_update_owner_manager on public.stores;
drop policy if exists stores_delete_owner on public.stores;
drop policy if exists "stores_select_own" on public.stores;
drop policy if exists "stores_insert_own" on public.stores;
drop policy if exists "stores_update_own" on public.stores;

create policy stores_select_member on public.stores
for select using (
  owner_user_id = auth.uid()
  or public.user_has_store_access(id)
);

create policy stores_insert_owner on public.stores
for insert with check (owner_user_id = auth.uid());

create policy stores_update_owner_manager on public.stores
for update using (public.user_has_store_role(id, array['owner','manager']))
with check (public.user_has_store_role(id, array['owner','manager']));

create policy stores_delete_owner on public.stores
for delete using (owner_user_id = auth.uid());

drop policy if exists user_profiles_select_same_store on public.user_profiles;
drop policy if exists user_profiles_insert_self on public.user_profiles;
drop policy if exists user_profiles_update_owner on public.user_profiles;
drop policy if exists user_profiles_delete_owner on public.user_profiles;
drop policy if exists "profiles_select_own" on public.user_profiles;
drop policy if exists "profiles_insert_own" on public.user_profiles;
drop policy if exists "profiles_update_own" on public.user_profiles;

create policy user_profiles_select_same_store on public.user_profiles
for select using (
  user_id = auth.uid()
  or public.user_has_store_access(store_id)
);

create policy user_profiles_insert_self on public.user_profiles
for insert with check (
  user_id = auth.uid()
  or public.user_has_store_role(store_id, array['owner'])
);

create policy user_profiles_update_owner_manager on public.user_profiles
for update using (
  user_id = auth.uid()
  or public.user_has_store_role(store_id, array['owner','manager'])
)
with check (
  user_id = auth.uid()
  or public.user_has_store_role(store_id, array['owner','manager'])
);

create policy user_profiles_delete_owner on public.user_profiles
for delete using (public.user_has_store_role(store_id, array['owner']));

do $$
declare
  table_name text;
  store_tables text[] := array[
    'product_categories',
    'categories',
    'ingredients',
    'products',
    'recipe_items',
    'packaging_items',
    'price_histories',
    'ingredient_aliases',
    'onboarding_support_settings',
    'billing_settings',
    'waste_records',
    'sales_records',
    'actual_cost_records',
    'inventory_records',
    'packaging_classifications',
    'event_plans',
    'event_plan_items',
    'labor_costs',
    'set_product_items',
    'ocr_documents',
    'ocr_extracted_items',
    'management_profiles',
    'management_external_factors',
    'management_diagnosis_answers',
    'management_diagnosis_results'
  ];
begin
  foreach table_name in array store_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);

      execute format('drop policy if exists tenant_select on public.%I', table_name);
      execute format('drop policy if exists tenant_insert on public.%I', table_name);
      execute format('drop policy if exists tenant_update on public.%I', table_name);
      execute format('drop policy if exists tenant_delete on public.%I', table_name);
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
        'create policy store_rows_insert on public.%I for insert with check (public.user_has_store_role(store_id, array[''owner'',''manager'',''staff'']))',
        table_name
      );
      execute format(
        'create policy store_rows_update on public.%I for update using (public.user_has_store_role(store_id, array[''owner'',''manager'',''staff''])) with check (public.user_has_store_role(store_id, array[''owner'',''manager'',''staff'']))',
        table_name
      );
      execute format(
        'create policy store_rows_delete on public.%I for delete using (public.user_has_store_role(store_id, array[''owner'',''manager'']))',
        table_name
      );
    end if;
  end loop;
end $$;

do $$
declare
  table_name text;
  log_tables text[] := array['ai_usage_logs', 'audit_logs'];
begin
  foreach table_name in array log_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);

      execute format('drop policy if exists tenant_select on public.%I', table_name);
      execute format('drop policy if exists tenant_insert on public.%I', table_name);
      execute format('drop policy if exists tenant_update on public.%I', table_name);
      execute format('drop policy if exists tenant_delete on public.%I', table_name);
      execute format('drop policy if exists store_rows_select on public.%I', table_name);
      execute format('drop policy if exists store_rows_insert on public.%I', table_name);
      execute format('drop policy if exists store_rows_update on public.%I', table_name);
      execute format('drop policy if exists store_rows_delete on public.%I', table_name);

      execute format(
        'create policy store_rows_select on public.%I for select using (public.user_has_store_access(store_id))',
        table_name
      );
      -- Inserts/updates/deletes are intentionally left to service_role API routes only.
    end if;
  end loop;
end $$;

-- Legacy PIN-login table is server-only through service_role. Keep RLS on and no client policy.
alter table if exists public.app_stores enable row level security;
