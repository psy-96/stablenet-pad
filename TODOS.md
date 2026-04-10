# TODOS.md — stablenet-pad

## 오픈 이슈

### ISSUE-1: 액션 이력 조회 UI
- `contract_actions` 테이블 데이터를 ContractActionPanel 하단 또는 별도 탭에서 표시
- 현재 실행 로그만 표시 (휘발성). Supabase에 쌓이지만 대시보드 조회 불가
- Priority: 중간

### ISSUE-2: CertiK Explorer 소스코드 검증
- 배포된 컨트랙트 소스코드를 Explorer에 검증 제출하는 플로우
- Priority: 낮음 (테스트넷 기준 필수 아님)

### ISSUE-5: Read 함수 미표시
- ContractActionPanel에서 write 함수만 표시, read(view/pure) 함수가 UI에 없음
- P2 QA(QA-REG-2) 중 발견
- ArrayTester의 getWhitelist(), getScores(), whitelistLength() 등 호출 불가
- Priority: 중간

### ISSUE-6: StableNet 대형 initcode 배포 실패
- UniswapV2Factory 등 embedded bytecode 포함 대형 컨트랙트 배포 시 status 0x0
- 메인넷개발팀 확인 중 (2026-04-10):
  - 초기 답변: "체인 코드상 최대 tx 사이즈 제한이 작음" — 정확한 원인 파악 진행 중
  - tx hash 혼동 정정 완료: 원본 실패 tx `0x8c0c5ea0...` 기준으로 분석 요청
  - 전달 자료: `dex-debug-input.txt` (input data 19,045 bytes, creationCode hex 전문)
- 상세 조사 내역: DECISIONS.md ADR-011 참조
- Priority: 높음 (DEX 시나리오 블로커, 현재 EIP-1167 우회로 사용 중)

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

## 진행 중: DEX 배포 시나리오

### 완료
- ✅ UniswapV2Pair 독립 배포: 0xf57283a136463f6c27daa5e55215a1102e355d75
- ✅ Light Factory (EIP-1167) 배포 + createPair() 성공 (Claude Code 검증)
  - Factory: 0xE3092F...
  - TokenA: 0xc01571... / TokenB: 0x101167...
  - Pair: 0x5bc238... (PairCreated 이벤트 확인)
- ✅ 원인 조사 완료 → ADR-011 기록
- ✅ 메인넷개발팀 문의 완료 (답변 대기 중)

### 다음 (새 대화에서 진행)
- Router 배포 (UniswapV2Router02)
- addLiquidity 테스트
- swap 테스트
- 배포 순서: Factory ✅ → Router → addLiquidity → swap

### 블로커
- ISSUE-6: 원본 Factory 배포 불가 → EIP-1167 우회 사용 중
- Router의 INIT_CODE_PAIR_HASH가 EIP-1167 clone 기준으로 변경 필요