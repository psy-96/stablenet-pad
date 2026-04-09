-- P1: 트랜잭션 이벤트 파싱 결과 저장
-- Supabase Dashboard > SQL Editor 에서 실행

alter table contract_actions add column if not exists events jsonb;
