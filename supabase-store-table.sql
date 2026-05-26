create table if not exists public.app_stores (
  id text primary key,
  pin_hash text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_stores enable row level security;

-- このアプリのサーバーAPIは SUPABASE_SERVICE_ROLE_KEY でアクセスします。
-- service_role はRLSをバイパスするため、ブラウザには絶対に公開しないでください。
