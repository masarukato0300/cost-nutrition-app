-- パティスリー経営ナビ 営業デモ店舗メモ
-- このSQLはデモテナントの確認用です。デモデータ本体は /api/demo-login が service_role で投入します。
-- 既存店舗データには触れません。

-- 正式デモ store_id:
-- 00000000-0000-4000-8000-000000000001
--
-- デモ表示名:
-- パティスリー・パティス
--
-- デモAuthメール:
-- demo@patisserie-management-navi.local

-- 1. 必須テーブルが存在するか確認
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'stores',
    'user_profiles',
    'ingredients',
    'products',
    'recipe_items',
    'product_categories',
    'price_histories',
    'ingredient_aliases',
    'waste_records',
    'sales_records',
    'actual_cost_records',
    'event_plans',
    'event_plan_items',
    'labor_costs',
    'set_product_items',
    'onboarding_support_settings',
    'billing_settings'
  )
order by table_name;

-- 2. RLSが有効か確認
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'stores',
    'user_profiles',
    'ingredients',
    'products',
    'recipe_items',
    'product_categories',
    'price_histories',
    'ingredient_aliases',
    'waste_records',
    'sales_records',
    'actual_cost_records',
    'event_plans',
    'event_plan_items',
    'labor_costs',
    'set_product_items',
    'onboarding_support_settings',
    'billing_settings'
  )
order by tablename;

-- 3. デモ店舗だけの件数確認
select 'ingredients' as table_name, count(*) from public.ingredients where store_id = '00000000-0000-4000-8000-000000000001'
union all select 'products', count(*) from public.products where store_id = '00000000-0000-4000-8000-000000000001'
union all select 'recipe_items', count(*) from public.recipe_items where store_id = '00000000-0000-4000-8000-000000000001'
union all select 'sales_records', count(*) from public.sales_records where store_id = '00000000-0000-4000-8000-000000000001'
union all select 'waste_records', count(*) from public.waste_records where store_id = '00000000-0000-4000-8000-000000000001';

-- 4. デモ以外の店舗にデモIDが混ざっていないか確認
select id, name
from public.stores
where id = '00000000-0000-4000-8000-000000000001';

-- 5. デモ店舗だけを削除したい場合の安全確認
-- 実行すると demo store_id の行だけ削除します。通常は使わないでください。
-- delete from public.stores where id = '00000000-0000-4000-8000-000000000001';
