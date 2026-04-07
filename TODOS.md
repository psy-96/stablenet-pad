# TODOS.md — stablenet-pad

**MVP 완료 ✓ — 2026-04-02**
Step 1~12 전체 PASS. Definition of Done 코드 레벨 항목 전부 충족.

---

## Step 2 — Base config files

- [x] `lib/supabase/server.ts`: `createClient` with `SUPABASE_SERVICE_ROLE_KEY`
- [x] `lib/supabase/client.ts`: `createClient` with `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] `lib/erc1967proxy.ts`: import ERC1967Proxy ABI + bytecode from OZ package artifact JSON
- [x] `lib/hardhat.ts`: `maxBuffer: 10 * 1024 * 1024` (10MB)

## Step 6 — Server compile API routes

- [x] `export const runtime = 'nodejs'` — 4개 API 라우트 전부
- [x] SSE `compiled` event: abi/bytecode 제외 (display-only)
- [x] POST /api/deploy 응답이 abi+bytecode authoritative

## Step 7 — Browser sign + send

- [x] `BigInt(params.initialSupply)` — ContractParamsForm 경계에서 변환
- [x] `BigInt(params.fee)` — LiquidityPool

---

## Step 12 — 전체 통합 QA (2026-04-02 완료)

- [x] MetaMask 연결 → Chain ID 8283 전환 확인 (코드 확인: Header.tsx isCorrectChain 가드)
- [x] ERC20 파일 업로드 → 컴파일 → MetaMask 서명 → txHash 확인 (실 배포 검증 완료)
- [x] Supabase deployments 테이블에 레코드 생성 확인 (실 배포 검증 완료)
- [x] GitHub push → 커밋 링크 확인 (실 배포 검증 완료)
- [x] LiquidityPool 배포 (ERC20 2개 선행 배포 후) — 템플릿 자동 배포 구현 완료
- [x] 재배포 확인 모달 → previousProxyAddress 보존 확인 (confirm/route.ts 코드 추적)
- [x] MetaMask 미설치 시 설치 링크 표시 (코드 확인: window.ethereum 체크)
- [x] WKRC 잔액 0일 때 경고 배너 표시 (코드 확인: balance.value === 0n 가드)
- [x] 잘못된 네트워크 처리 (코드 확인: chainId !== 8283 전환 버튼)
- [x] 컴파일 오류 처리 (코드 확인: SSE error 이벤트 + 422 반환)
- [x] MetaMask 서명 거부 처리 (에러 로그 표시 + 배포 버튼 재활성화로 재시도 가능)
- [x] GitHub push 실패 처리 (에러 로그 + downloadArtifact 버튼 활성화)
- [x] /tmp/contracts/ 임시 파일 정리 (confirm 즉시 + setTimeout 1h 이중 정리)
- [x] npx tsc --noEmit → exit 0
- [x] npx eslint . → exit 0

## 성능 노트

- Hardhat compile: 15-30s (첫 실행, OZ imports), ~3s (캐시)
- GitHub PUT: sha GET 1회 추가 (~100ms), PoC에서 허용

## Test plan

`~/.gstack/projects/psy-96-stablenet-pad/test-plan.md` 참고

---

## Phase 1-A — Template Library (우선 완료)

> 목표: 새 템플릿을 파일 1개 추가만으로 배포 가능하게 만들기
> 결정: Template Registry → TemplateCatalog → Generic Upload 순서로 진행

### 1. Supabase 마이그레이션 (코드 작업 전 선행)
- [x] `deployments.type` check constraint DROP (`ALTER TABLE deployments DROP CONSTRAINT ...`)
  - Why: Generic 배포 및 신규 템플릿 타입 대응
  - 앱 레벨에서 registry.id 조회로 검증 대체

### 2. `lib/template-registry.ts` 신규
- [x] `TemplateParam` 인터페이스: key, label, type ('text'|'address'|'uint256'|'address-select'), fetchUrl?
- [x] `TemplateDefinition` 인터페이스: id, label, solFile, params, useProxy(기본 true)
- [x] `TEMPLATE_REGISTRY: TemplateDefinition[]` — ERC20, LiquidityPool 이전
- [x] ERC20 params: name(text), symbol(text), initialSupply(uint256)
- [x] LiquidityPool params: tokenA(address-select, fetchUrl='/api/deployments?type=ERC20'), tokenB(같음), fee(uint256)
- [x] `getTemplateById(id: string): TemplateDefinition | undefined` 헬퍼

### 3. `app/api/template/route.ts` 변경
- [x] `TEMPLATE_MAP` 제거 → `TEMPLATE_REGISTRY`에서 derive
- [x] `getTemplateById(type).solFile`로 경로 조회
- [x] `path.resolve(process.cwd(), solFile)` — CWD 기준 절대 경로 보장

### 4. `app/api/deploy/route.ts` 변경
- [x] `contractType: ContractType` → `contractType: string`으로 완화
- [x] Template 배포 시: `getTemplateById(contractType)` 존재 여부 체크 → 없으면 400
- [x] 파라미터 검증: registry.params 기반으로 필수 key 존재 여부만 체크 (타입별 하드코딩 제거)
- [x] `deployMode` 필드는 서버에 추가하지 않음 (클라이언트 관심사)

### 5. `components/ContractParamsForm.tsx` 리팩터링
- [x] props: `contractType: ContractType` → `params: TemplateParam[]`
- [x] address-select: `fetchUrl` 기반 fetch (중복 fetchUrl은 한 번만 요청)
- [x] address-select 빈 결과 → "ERC20 토큰을 먼저 배포하세요" 경고 + Deploy 비활성
- [x] address-select fetch 실패 → 에러 메시지 + Deploy 비활성
- [x] uint256 → 음수 입력 방지
- [x] address → 0x 미포함 시 유효성 경고

### 6. `hooks/useDeploy.ts` 변경
- [x] `encodeInitData` 리팩터링: contractType switch 제거 → ABI input.type 기반 인코딩
  - uint256 / uint24 → BigInt(value)
  - string / address → raw value
  - 지원 외 타입 → throw 명시적 에러
- [x] `buildConstructorArgs`: 빈 배열 반환 유지 (Upgradeable 패턴)
- [x] `contractType: ContractType` → `contractType: string`으로 타입 완화

### 7. `components/TemplateCatalog.tsx` 신규
- [x] TEMPLATE_REGISTRY를 카드 목록으로 렌더링
- [x] 카드 클릭 → 선택 상태, ContractParamsForm에 registry.params 전달

### 8. `components/DeployPanel.tsx` 변경
- [x] 탭: "템플릿 선택" | "파일 업로드" (기존 ERC20/LP 탭 대체)
- [x] 템플릿 탭: TemplateCatalog + ContractParamsForm(registry.params)
- [x] 업로드 탭: 기존 ERC20 업로드 UI 유지 (Phase 1-A에서는 변경 없음)

### 9. `types/index.ts` 변경
- [x] `ContractType = 'ERC20' | 'LiquidityPool'` → `string` (또는 유지 + Phase 1-B에서 제거)
- [x] `TemplateParam` 인터페이스 추가
- [x] `TemplateDefinition` 인터페이스 추가 (또는 lib/template-registry.ts에만)

### 10. 테스트 (Phase 1-A)
- [x] `npm install -D vitest @vitejs/plugin-react jsdom` 설치
- [x] `__tests__/lib/template-registry.test.ts`: registry 구조, getTemplateById
- [x] `__tests__/hooks/encodeInitData.test.ts`: 회귀 테스트 (ERC20/LP 인코딩 전후 동일)
- [x] `__tests__/components/ContractParamsForm.test.tsx`: TemplateParam[] 기반 렌더링

### Phase 1-A QA
- [x] ERC20 템플릿 카드 → 파라미터 입력 → MetaMask 서명 → 배포 완료 확인
- [x] LiquidityPool 템플릿 → ERC20 드롭다운 정상 로드 확인
- [x] 신규 템플릿 추가 테스트: `contracts/templates/`에 .sol 파일 + registry 1줄 추가만으로 배포 가능 확인
- [x] npx tsc --noEmit → exit 0
- [x] npx eslint . → exit 0

---

## Phase 1-A QA 버그 픽스 (2026-04-07 완료)

- [x] Railway production 빌드 실패: `hardhat` → `dependencies` 이동
- [x] Hardhat sources 범위: `contracts/templates/` 만으로 제한 (`hardhat.config.ts paths.sources`)
- [x] `ReentrancyGuardUpgradeable` OZ v5 제거됨: `SimpleVault.sol` inline guard로 대체
- [x] artifact 경로 버그: `contractName` ≠ 내부 contract 이름 → `readdir` 탐색으로 수정
- [x] `_tmp_` prefix: 임시 컴파일 파일이 원본 템플릿 덮어쓰는 버그 방지
- [x] ERC20 재배포 오탐: 템플릿 모드 재배포 감지 전체 제외 (업로드 모드 전용)
- [x] LP 파라미터 키 불일치: registry keys `_tokenA`, `_tokenB`, `_fee` (ABI 기준)
- [x] 잔액 조회 fallback: `isError` 처리 + `chainId` 명시 + `"- WKRC"` fallback
- [x] 수수료 필드 hint: `TemplateParam` `placeholder`/`hint` 필드 추가
- [x] GitHub push 파일명: `{contractName}_{addr8}.json`
- [x] GitHub push 경로: `deployments/stablenet-testnet/{type}/{name}_{addr8}.json`

---

## Phase 1-B 시작 전 체크리스트

> 선행 조건: 아래 항목 전부 ✅ 후 `/plan-eng-review` 실행

- [ ] Railway 재배포 후 QA Scene 2 — ERC20 템플릿 배포 end-to-end
- [ ] QA Scene 3 — LiquidityPool 템플릿 배포 (ERC20 2개 선배포 후)
- [ ] QA Scene 4 — 파일 업로드 배포 (기존 .sol 업로드)
- [ ] GitHub `deployments/stablenet-testnet/{type}/` 경로 파일 생성 확인
- [ ] VISION.md Phase 2에 "배포 결과 저장 경로 커스터마이징" 항목 추가
- [ ] npx tsc --noEmit → exit 0
- [ ] npx eslint . → exit 0

---

## Phase 1-B — Generic Upload 2단계 흐름 (Phase 1-A 완료 후)

> 선행 조건: Phase 1-A 완료 + 팀이 Generic Upload 수요 확인

- [ ] `components/GenericDeploySection.tsx` 신규
  - 상태 머신: 'upload' → 'compiling-preview' → 'params' → 'deploying' → 'done'
  - 컴파일 실패 시: 에러 표시 + 'upload' 상태로 복귀 (파일 보존)
  - 파라미터 입력 후 뒤로가기: 'upload' 복귀 (파일 + 파라미터 상태 초기화)
- [ ] compile-preview SSE 생명주기
  - 'compiled' 이벤트 수신 시 client EventSource.close()
  - 'deploy' 클릭 시 새 SSE stream (새 deploymentId로)
  - server-side: deploymentId별 독립 EventEmitter → 두 stream 간 간섭 없음
- [ ] ABI → TemplateParam[] 자동 생성
  - initialize() 있으면: inputs를 TemplateParam[]로 변환
  - 지원 타입: string, address, uint256, uint24, uint8 scalar만
  - 지원 외 타입 있으면: "지원하지 않는 파라미터 타입 포함" 에러 + 배포 불가
- [ ] hasInitializer → Proxy 토글 경고 (auto-lock 아님)
  - initialize() 없음: ⚠ 경고 표시, 토글은 사용자가 직접 제어
- [ ] 파일 업로드 보안 강화
  - .sol 파일명 패턴: `/^[a-zA-Z0-9_-]+\.sol$/`
  - Content-Type 검증 추가
- [ ] `app/api/deploy/confirm/route.ts`: Generic 배포 시 type = contractName 저장

## 성능 노트

- Hardhat compile: 15-30s (첫 실행, OZ imports), ~3s (캐시)
- GitHub PUT: sha GET 1회 추가 (~100ms), PoC에서 허용
- address-select: 동일 fetchUrl 중복 요청 방지 (fetchedUrls ref로 dedup)
- Railway 배포: https://stablenet-pad-production.up.railway.app
  - main push → 자동 재배포 (빌드 ~2-3분)
  - NODE_TLS_REJECT_UNAUTHORIZED=0 설정됨 (StableNet RPC TLS 우회)
