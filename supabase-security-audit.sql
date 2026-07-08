-- パティスリー経営ナビ: 販売前 Supabase セキュリティ監査SQL
-- 目的:
-- 1. 主要テーブルのRLSが有効か確認
-- 2. 業務テーブルに store_id があるか確認
-- 3. anon に業務テーブル権限が残っていないか確認
-- 4. store_id 基準ポリシーがあるか確認
--
-- このSQLは確認専用です。データは変更しません。

with expected_tables(table_name) as (
  values
    ('stores'),
    ('user_profiles'),
    ('product_categories'),
    ('categories'),
    ('ingredients'),
    ('products'),
    ('recipe_items'),
    ('packaging_items'),
    ('price_histories'),
    ('ingredient_aliases'),
    ('onboarding_support_settings'),
    ('billing_settings'),
    ('waste_records'),
    ('sales_records'),
    ('actual_cost_records'),
    ('inventory_records'),
    ('inventory_input_settings'),
    ('packaging_classifications'),
    ('event_plans'),
    ('event_plan_items'),
    ('labor_costs'),
    ('set_product_items'),
    ('ocr_documents'),
    ('ocr_extracted_items'),
    ('management_profiles'),
    ('management_external_factors'),
    ('management_diagnosis_answers'),
    ('management_diagnosis_results'),
    ('ai_usage_logs'),
    ('audit_logs'),
    ('app_stores')
)
select
  e.table_name,
  case when c.relname is null then 'missing' else 'exists' end as table_status,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  exists (
    select 1
    from information_schema.columns col
    where col.table_schema = 'public'
      and col.table_name = e.table_name
      and col.column_name = 'store_id'
  ) as has_store_id,
  coalesce((
    select string_agg(p.polname, ', ' order by p.polname)
    from pg_policy p
    where p.polrelid = c.oid
  ), '') as policies
from expected_tables e
left join pg_class c
  on c.relname = e.table_name
 and c.relnamespace = 'public'::regnamespace
order by e.table_name;

-- anon に残っているテーブル権限を確認します。
-- 業務テーブルがここに出る場合は、supabase-production-store-rls.sql を実行して権限を締めてください。
select
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
order by table_name, privilege_type;

-- store_id が必要なのに未付与の可能性があるpublicテーブルを確認します。
-- stores / user_profiles / app_stores は例外です。
select
  t.table_name
from information_schema.tables t
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
  and t.table_name not in ('stores', 'user_profiles', 'app_stores')
  and not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = t.table_schema
      and c.table_name = t.table_name
      and c.column_name = 'store_id'
  )
order by t.table_name;
