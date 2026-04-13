-- deployments 테이블에 source 컬럼 추가 (ISSUE-8)
-- 'deployed': stablenet-pad로 직접 배포
-- 'imported': ABI+주소 수동 임포트 (외부 컨트랙트)

alter table deployments
  add column if not exists source varchar(20) not null default 'deployed'
    check (source in ('deployed', 'imported'));
