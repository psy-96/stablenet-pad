# TODOS.md — stablenet-pad

## 오픈 이슈

### ISSUE-1: 액션 이력 조회 UI
- `contract_actions` 테이블 데이터를 ContractActionPanel 하단 또는 별도 탭에서 표시
- 현재 실행 로그만 표시 (휘발성). Supabase에 쌓이지만 대시보드 조회 불가
- Priority: P2 작업 전 처리 권장

### ISSUE-2: CertiK Explorer 소스코드 검증
- 배포된 컨트랙트 소스코드를 Explorer에 검증 제출하는 플로우
- Priority: 낮음 (테스트넷 기준 필수 아님)

### ISSUE-3: Supabase 마이그레이션 수동 실행 (블로커)
- `supabase/migrations/20260408_contract_actions.sql` 실행 필요
- Supabase Dashboard > SQL Editor에서 직접 실행

---

## 진행 중: P1 — 트랜잭션 이벤트 파싱 + UI 표시

### 배경
DEX Factory.createPair() 실행 후 생성된 Pair 주소를 PairCreated 이벤트에서 읽어야 함.
현재 ContractActionPanel은 tx hash만 표시, 이벤트 파싱 없음.

### Task 1: Supabase migration
- `contract_actions` 테이블에 `events jsonb` 컬럼 추가
- 파일: `supabase/migrations/YYYYMMDDHHMMSS_add_events_to_contract_actions.sql`
```sql
alter table contract_actions add column if not exists events jsonb;
```

### Task 2: /api/actions/confirm 수정
- 위치: `src/app/api/actions/confirm/route.ts`
- receipt.logs를 해당 컨트랙트 ABI로 디코딩 (viem `decodeEventLog` 사용)
- ABI는 Supabase deployments 테이블에서 deployment_id로 조회
- 파싱된 이벤트 배열을 `contract_actions.events` 컬럼에 저장
- response body에도 `events` 포함해서 반환

```typescript
import { decodeEventLog } from 'viem'

const events = receipt.logs.flatMap(log => {
  try {
    const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics })
    return [{ name: decoded.eventName, args: decoded.args }]
  } catch {
    return [] // 다른 컨트랙트 이벤트 무시
  }
})
```

### Task 3: ContractActionPanel UI 수정
- 위치: `src/components/ContractActionPanel.tsx`
- 트랜잭션 성공 후 events 배열 표시
- 이벤트명 + args를 key: value로 렌더링
- address 타입은 클릭 시 Explorer 링크
- 예시: `PairCreated → token0: 0xABC... token1: 0xDEF... pair: 0x123...`

### Task 4: 테스트 업데이트
- confirm route 테스트에 events 파싱 케이스 추가
- ContractActionPanel 테스트에 이벤트 표시 케이스 추가
- 전체 통과: tsc + eslint + vitest

### 완료 조건
- createPair() 실행 후 Pair 주소가 UI에 자동으로 표시됨
- contract_actions.events 컬럼에 파싱된 이벤트 JSON 저장됨
- 전체 테스트 통과

---

## 다음: P2 — 배열/튜플 타입 파라미터 입력 UI

- `address[]` 등 배열 타입 파라미터 입력 UI 없음
- `swapExactTokensForTokens(uint, uint, address[], address, uint)` 실행 불가
- P1 완료 후 스펙 확정 예정