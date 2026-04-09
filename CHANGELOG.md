# CHANGELOG.md — stablenet-pad

## Phase 2 완료 — 2026-04-08
운영 액션 레이어, vitest 53/53 PASS

- `contract_actions` Supabase 테이블
- `ContractActionPanel` 컴포넌트
- `useContractAction` 훅
- `/api/actions/confirm` 엔드포인트
- Write 함수 파싱, MetaMask 실행, 액션 로깅

## Phase 1-B 완료 — 2026-04-08
Generic .sol 업로드 배포

- `GenericDeploySection` 컴포넌트 (5-state machine)
- ABI → TemplateParam[] 자동 생성 (`abiInputsToTemplateParams()`)
- Proxy 토글, .sol 파일명 패턴 검증
- Generic 배포 시 type = contractName 저장

## Phase 1-A 완료 — 2026-04-08
Template Library (ERC20, LiquidityPool, SimpleVault)

- `lib/template-registry.ts`: TemplateDefinition, TemplateParam 인터페이스
- `TemplateCatalog` 컴포넌트
- `ContractParamsForm` 리팩터링 (TemplateParam[] 기반)
- `DeployPanel` 탭 구조: 템플릿 선택 | 파일 업로드
- address-select 타입: fetchUrl 기반 동적 드롭다운
- QA 버그 픽스: Railway 빌드, OZ v5 호환, artifact 경로, LP 파라미터 키 등

## MVP 완료 — 2026-04-02

- ERC20 .sol 업로드 → 파라미터 → MetaMask 서명 → Proxy+Implementation 2-tx 배포
- LiquidityPool 내부 템플릿 배포
- Supabase 저장 + GitHub 자동 push + 대시보드 이력 조회
- tsc/eslint clean, 전체 QA PASS