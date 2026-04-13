# CHANGELOG.md — stablenet-pad

## 2026-04-13 (latest)

### V3 메뉴 UI 추가
- `lib/v3-config.ts`: V3 Factory / PositionManager / SwapRouter 주소·ABI·DeploymentResult 상수
- `components/V3Panel.tsx`: ERC20 배포 단축 + 3개 컨트랙트 ContractActionPanel
- 환경변수: `NEXT_PUBLIC_V3_FACTORY_ADDRESS` / `NEXT_PUBLIC_V3_ROUTER_ADDRESS` / `NEXT_PUBLIC_V3_POSITION_MANAGER_ADDRESS`
- `app/page.tsx`: "V3 작업" 탭에 V3Panel 연결 (Coming Soon 제거)

### tuple 파라미터 UI 지원
- `classifyAbiType`: `tuple` → `'tuple'` (기존 `'disabled'` 해제)
- `ContractActionPanel`: ABI `components` 기반 재귀 서브 필드 렌더링 (dotted key 방식)
- `useContractAction`: tuple args → 컴포넌트 배열 조립 → viem 인코딩
- 부호 있는 `int*` 입력 지원 (음수 허용)
- `tuple[]` 및 기타 복합 배열 타입은 `disabled` 유지

### V3 컨트랙트 배포 완료 (StableNet Testnet)
- `scripts/v3-deploy/` 독립 Hardhat 프로젝트, pre-compiled artifact + 라이브러리 링킹 수동 처리

  | 컨트랙트 | 주소 |
  |---|---|
  | UniswapV3Factory | `0xa0f51De7c6267fd10b168d941CB06093E76785D7` |
  | NonfungiblePositionManager | `0xAA52Bd6b11944343523dBC68C2B5f602D33A6e72` |
  | SwapRouter | `0x659BC8F37fb6EC52289B3c44cf6Fa6764ad113dF` |
  | NonfungibleTokenPositionDescriptor | `0x6D00b02eA7Ec68B42D9a5B1a2aa61F6FA231aE3C` |

### ISSUE-1: 액션 이력 조회 UI ✅
- `GET /api/actions?contract_address=0x...`: deployments → contract_actions 2-step 조회
- `ContractActionPanel` "이력" 탭: 최근 20건, 파라미터·이벤트 접기/펼치기

### ISSUE-5: Read 함수 UI ✅
- `lib/abi-utils.ts`: `abiReadFunctionsToActions()` 순수 함수
- `ContractActionPanel` Write / Read 탭 분리
- `POST /api/contracts/read`: 서버사이드 `readContract()` (CORS 우회)

### ISSUE-7: 배포 이력 핀/즐겨찾기 ✅
- `deployments.pinned boolean` 컬럼 (Supabase migration 필요)
- `PATCH /api/deployments/[id]/pin`: 핀 토글
- `DeployHistory`: ⭐ 버튼 + optimistic update, 핀된 항목 최상단 고정

### ISSUE-8: 외부 컨트랙트 임포트 ✅
- `POST /api/deployments/import`: ABI + 주소 → deployments 테이블 저장
- `DeployPanel` "임포트" 탭: ABI JSON 붙여넣기 + 주소 입력

### ISSUE-9: uint256 인코딩 ✅ (ISSUE-6 수정 시 함께 해결)
- `encodeArg`: string → BigInt 변환, 경계값 정상 처리

### V2 메뉴 UI 완료
- `components/V2Panel.tsx`: ERC20 배포 단축 + Factory/Router ContractActionPanel
- `lib/v2-config.ts`: 주소·ABI·DeploymentResult 상수, 환경변수 분리
  - `NEXT_PUBLIC_V2_FACTORY_ADDRESS`, `NEXT_PUBLIC_V2_ROUTER_ADDRESS`

---

## 2026-04-13 (earlier)

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