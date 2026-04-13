-- deployments 테이블에 pinned 컬럼 추가
-- 핀된 컨트랙트는 배포 이력 목록 최상단에 고정 표시 (ISSUE-7)

alter table deployments
  add column if not exists pinned boolean not null default false;

create index if not exists idx_deployments_pinned_created
  on deployments(pinned desc, created_at desc);
