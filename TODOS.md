# TODOS.md — stablenet-pad

## 오픈 이슈

### ISSUE-2: CertiK Explorer 소스코드 검증 — 대기
- 배포된 컨트랙트 소스코드를 Explorer에 검증 제출하는 플로우
- **현재 상태**: Explorer verify API 미제공, 수동 검증만 가능
- Priority: 낮음

---

## 다음 작업

### V3 풀 플로우 테스트
- V3 메뉴 UI 완료. 다음 단계: createPool → mint → swap 실제 실행 검증
- PositionManager `mint(MintParams)` — tuple 파라미터 UI로 실행 가능
- SwapRouter `exactInputSingle(ExactInputSingleParams)` — tuple 파라미터 UI로 실행 가능

---

## 완료: ISSUE-1 — 액션 이력 조회 UI ✅ (2026-04-13)
- `GET /api/actions?contract_address=0x...`: deployments → contract_actions 2-step 조회
- `ContractActionPanel` "이력" 탭: 최근 20건, 파라미터·이벤트 접기/펼치기

---

## 완료: ISSUE-5 — Read 함수 UI ✅ (2026-04-13)
- `lib/abi-utils.ts`: `abiReadFunctionsToActions()` 순수 함수
- `ContractActionPanel` Write / Read 탭 분리, `POST /api/contracts/read` 서버사이드 실행

---

## 완료: ISSUE-7 — 배포 이력 핀/즐겨찾기 ✅ (2026-04-13)
- `deployments.pinned boolean` 컬럼, `PATCH /api/deployments/[id]/pin`
- `DeployHistory` ⭐ 버튼 + optimistic update, 핀된 항목 최상단 고정
- Supabase migration: `supabase/migrations/20260413_add_pinned_to_deployments.sql` 실행 완료

---

## 완료: ISSUE-8 — 외부 컨트랙트 임포트 ✅ (2026-04-13)
- `POST /api/deployments/import`: ABI + 주소 → deployments 테이블 저장
- `DeployPanel` "임포트" 탭: ABI JSON 붙여넣기 + 주소 입력

---

## 완료: ISSUE-9 — uint256 인코딩 ✅ (2026-04-13, ISSUE-6 수정 시 함께 해결)
- `encodeArg` string → BigInt 변환 정상 처리, deadline 경계값 이상 없음

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

## 완료: tuple 파라미터 UI ✅ (2026-04-13)
- `classifyAbiType`: `tuple` → `'tuple'` 분류 (기존 `'disabled'` 해제)
- `ContractActionPanel`: components 기반 재귀 서브 필드 렌더링
- `useContractAction`: tuple args → 컴포넌트 배열 조립 → viem 인코딩
- V3 PositionManager `mint(MintParams)`, SwapRouter `exactInputSingle` 등 struct 입력 지원

---

## 완료: V2 메뉴 UI ✅ (2026-04-13)
- `lib/v2-config.ts`, `components/V2Panel.tsx`
- V2 Factory / Router 주소 환경변수 분리
- `app/page.tsx` 탭 구조: V2 작업 / V3 작업 / 일반 작업

---

## 완료: V3 컨트랙트 배포 ✅ (2026-04-13, Pad 외부 Hardhat 스크립트)
- `scripts/v3-deploy/` 독립 Hardhat 프로젝트

  | 컨트랙트 | 주소 |
  |---|---|
  | UniswapV3Factory | `0xa0f51De7c6267fd10b168d941CB06093E76785D7` |
  | NonfungiblePositionManager | `0xAA52Bd6b11944343523dBC68C2B5f602D33A6e72` |
  | SwapRouter | `0x659BC8F37fb6EC52289B3c44cf6Fa6764ad113dF` |
  | NonfungibleTokenPositionDescriptor | `0x6D00b02eA7Ec68B42D9a5B1a2aa61F6FA231aE3C` |

---

## 완료: V3 메뉴 UI ✅ (2026-04-13)
- `lib/v3-config.ts`, `components/V3Panel.tsx`
- Factory / PositionManager / SwapRouter ContractActionPanel + ERC20 배포 단축
