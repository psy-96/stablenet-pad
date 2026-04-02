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
