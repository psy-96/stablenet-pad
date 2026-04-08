-- Phase 2: 운영 액션 이력 테이블
-- Supabase Dashboard > SQL Editor 에서 실행

create table if not exists contract_actions (
  id            uuid primary key default gen_random_uuid(),
  deployment_id uuid references deployments(id) on delete set null,
  function_name text not null,
  params        jsonb,
  tx_hash       text,
  block_number  integer,
  executor      text,
  network       text not null default 'stablenet-testnet',
  status        text not null default 'success' check (status in ('success', 'failed')),
  created_at    timestamptz not null default now()
);

create index if not exists idx_contract_actions_deployment_id on contract_actions(deployment_id);
create index if not exists idx_contract_actions_created_at on contract_actions(created_at desc);
