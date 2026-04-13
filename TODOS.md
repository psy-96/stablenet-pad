# TODOS.md — stablenet-pad

## 오픈 이슈

### ISSUE-1: 액션 이력 조회 UI
- `contract_actions` 테이블 데이터를 ContractActionPanel 하단 또는 별도 탭에서 표시
- 현재 실행 로그만 표시 (휘발성). Supabase에 쌓이지만 대시보드 조회 불가
- Priority: 중간

### ISSUE-2: CertiK Explorer 소스코드 검증
- 배포된 컨트랙트 소스코드를 Explorer에 검증 제출하는 플로우
- Explorer에서 Contract Verification 가능한 것 확인됨. 자동/수동 여부 미확인.
- Priority: 낮음

### ISSUE-5: Read 함수 미표시
- ContractActionPanel에서 write 함수만 표시, read(view/pure) 함수가 UI에 없음
- P2 QA(QA-REG-2) 중 발견
- Priority: 중간

### ISSUE-7: 배포 이력 핀/즐겨찾기 — 코드 완료, Supabase migration 미실행
- `deployments` 테이블 `pinned boolean DEFAULT false` 컬럼 추가
- `PATCH /api/deployments/[id]/pin` 엔드포인트 구현
- `DeployHistory.tsx` ⭐ 버튼 + optimistic update 구현
- **미실행**: `supabase/migrations/20260413_add_pinned_to_deployments.sql` Dashboard SQL Editor에서 실행 필요
- Priority: 중간

### ISSUE-8: 외부 컨트랙트 관리 불가
- Pad에서 배포하지 않은 컨트랙트(예: WKRC `0x0000000000000000000000000000000000001000`)는 배포 이력에 없어서 함수 호출 불가
- ABI + 주소 수동 입력으로 임의 컨트랙트 관리 기능 필요
- Priority: 중간

### ISSUE-9: 대형 uint256 값 인코딩 이슈
- deadline에 `9999999999` 입력 시 "UniswapV2Router: EXPIRED" revert
- `99999999999999` 입력 시 성공 → 특정 범위에서 정밀도 손실 가능성
- `buildConstructorArgs` 또는 `encodeArg`에서 uint256 → BigInt 변환 시 경계값 동작 확인 필요
- Priority: 낮음

---

## 완료: ISSUE-6 — constructor arg 인코딩 버그 ✅ (2026-04-10)
- 근본 원인: `buildConstructorArgs`가 항상 `[]`를 반환하는 Pad 버그. 체인 제한 아님.
- ABI constructor inputs 기반으로 params 인코딩으로 수정
- vitest 84 → 98 (신규 15개 테스트 추가)
- 상세 조사 내역: DECISIONS.md ADR-011 참조

---

## 완료: ISSUE-4 — 액션 revert 시 프론트엔드 성공 표시 UX 버그 ✅ (2026-04-10)

- /api/actions/confirm이 status 400 반환 시 ContractActionPanel에서 에러 상태로 전환
- "트랜잭션 실패 (revert)" 메시지 + ✗ 표시
- 기존 "실행 완료 ✓" + "액션 이력 저장 실패" 오해 메시지 제거

---

## 완료: ISSUE-3 — tx status 0x0 성공 처리 버그 ✅ (2026-04-09)

- deploy/confirm: receipt.status === 'reverted' 시 배포 실패 처리 + 에러 반환
- actions/confirm: receipt 항상 조회, reverted 시 status:'failed' 저장 + 에러 반환
- actions/confirm: 진단용 console.log 및 raw RPC fetch 제거 (클린업)

---

## 완료: P2 — 배열/튜플 타입 파라미터 입력 UI ✅ (2026-04-09)

- ActionParamType에 `array` 추가, ActionParam에 `arrayItemSolType` 필드 추가
- classifyAbiType: address[], uint256[] 등 단일 원소 배열 → array 분류
- classifyAbiType: tuple[] 등 복합 배열 → disabled 유지 (향후 대응)
- abiWriteFunctionsToActions: array 타입 파라미터에 arrayItemSolType 세팅
- encodeArg: 배열 타입 JSON 파싱 → 재귀 인코딩
- ContractActionPanel: array 파라미터 동적 항목 추가/삭제 UI (+ 버튼)
- canExecute: array 파라미터 유효성 검사 추가
- vitest 84/84 PASS

---

## 완료: P1 — 트랜잭션 이벤트 파싱 + UI 표시 ✅ (2026-04-09)

- contract_actions.events jsonb 컬럼 추가 (migration)
- lib/parse-events.ts: parseReceiptEvents() 구현
- /api/actions/confirm: 이벤트 파싱 → 저장 + 응답 포함
- ContractActionPanel: 이벤트 블록 렌더링, address → Explorer 링크
- vitest 80/80 PASS

### P1 QA 중 발견 및 픽스된 Pad 버그
- ✅ flattened .sol 업로드 시 파일명 일치 artifact 우선 선택
- ✅ Proxy OFF 시 constructor 파라미터 폼 미표시
- ✅ Proxy OFF 시 주소가 잘못된 컬럼(proxy_address)에 저장
- ✅ Proxy OFF 시 배포 이력 카드 "관리" 버튼 미표시
- ✅ Proxy OFF 시 ResultPanel 미표시

---

## P2 QA 결과 (2026-04-10)

### ISSUE-3 검증
- ✅ QA-3-1: 배포 실패 시 status 0x0 → "저장 실패" 정상 표시
- ✅ QA-3-2: 액션 실패 시 Supabase status='failed' 저장
- ✅ QA-3-3: 정상 케이스 회귀 (Proxy ON/OFF, write 함수) 통과

### P2 배열 UI 검증
- ✅ QA-P2-1: address[] 3개 입력 → setWhitelist 실행 → WhitelistUpdated 이벤트 확인
- ✅ QA-P2-2: uint256[] 입력 → setScores 실행 확인
- ⚠️ QA-P2-3: 빈 배열 전송 가능 (Solidity에서 유효하므로 허용)
- ✅ QA-P2-4: 잘못된 주소 입력 → 실행 차단 + 에러 메시지
- 🔲 QA-P2-5: tuple[] disabled 확인 (미검증 — ArrayTester에 tuple 없음)

### 회귀 검증
- ✅ QA-P1-R1: 이벤트 파싱 정상 (P2-1 테스트 중 확인)
- 🔲 QA-REG-1: 배포 플로우 회귀 (템플릿 배포 미재검증)
- ⚠️ QA-REG-2: read 함수 미표시 발견 → ISSUE-5 등록

---

## 완료: DEX 배포 시나리오 ✅ (2026-04-10)

- ✅ Factory 배포 (원본, Pair bytecode 내장): `0xec1c0fb2ceaa7349b381e5bdd574f6369b4129ce`
- ✅ createPair 성공
- ✅ ERC20 × 2 배포 (TestToken, constructor에서 deployer에게 mint)
- ✅ approve × 2
- ✅ addLiquidity 성공
- ✅ swapExactTokensForTokens 성공 (tx: `0x5d7fc7c7d82a77357d7470693e73880d4e7390454da5b0570fa97e2de4ead93f`)
- ✅ Router 배포: `0xe56c3f0375ec5644509715c42aa8764d4c857d01`

ISSUE-6 수정(buildConstructorArgs 버그 픽스)으로 원본 Factory 배포 성공.
EIP-1167 우회(Light Factory)는 불필요했음 — ADR-011 참조.

---

## 팀원 공유 완료 (2026-04-10)

| 컨트랙트 | 주소 |
|---|---|
| UniswapV2Factory | `0xec1c0fb2ceaa7349b381e5bdd574f6369b4129ce` |
| UniswapV2Router02 | `0xe56c3f0375ec5644509715c42aa8764d4c857d01` |
| WKRC | `0x0000000000000000000000000000000000001000` |
| INIT_CODE_PAIR_HASH | `0x01849f1b5d62ec92cb6255b91bb5968f5c4084f663ed79eb719d5ce7e07986b1` |

ABI 파일 팀원에게 공유 완료.

---

## 미실행 인프라

- 🔲 Supabase migration: `supabase/migrations/20260413_add_pinned_to_deployments.sql` — Dashboard SQL Editor에서 실행 필요 (ISSUE-7 핀 기능 활성화)
