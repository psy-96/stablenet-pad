# CHANGELOG.md — stablenet-pad

## 2026-04-13

### ISSUE-7 핀/즐겨찾기 구현
- `deployments` 테이블 `pinned boolean DEFAULT false` 컬럼 + 복합 인덱스
- `PATCH /api/deployments/[id]/pin` — pinned 토글 엔드포인트
- `DeployHistory.tsx` ⭐ 버튼, optimistic update + 실패 시 롤백
- 핀된 항목 최상단 고정: `ORDER BY pinned DESC, created_at DESC`
- limit 10 → 50 (핀 기능과 함께 더 넓은 이력 표시)

---

## 2026-04-10

### ISSUE-6 수정
- 근본 원인: `hooks/useDeploy.ts` `buildConstructorArgs`가 항상 `[]` 반환
- ABI constructor inputs 기반 파라미터 매핑으로 수정
- `uint256` → `BigInt`, `address`/`string` → passthrough
- vitest 83 → 98 (신규 15개 테스트 추가)

### DEX 풀 플로우 검증 완료
- Factory 배포 → createPair → ERC20×2 → approve → addLiquidity → swap 성공
- Uniswap V2 AMM 정상 작동 확인 (0.3% fee, price impact 반영)
- 발견된 Pad 기능 갭 3개: ISSUE-7, 8, 9 등록

### 팀원용 DEX 인프라 배포
- Factory: `0xec1c0fb2ceaa7349b381e5bdd574f6369b4129ce`
- Router: `0xe56c3f0375ec5644509715c42aa8764d4c857d01`
- INIT_CODE_PAIR_HASH: `0x01849f1b5d62ec92cb6255b91bb5968f5c4084f663ed79eb719d5ce7e07986b1`
- ABI 파일 팀원 공유 완료

---

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