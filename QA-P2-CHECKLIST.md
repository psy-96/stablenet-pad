# P2 + ISSUE-3 QA 체크리스트 (2026-04-09~10)

수동 QA. Railway 배포 환경에서 MetaMask + StableNet Testnet 기준 실행.

---

## ISSUE-3: receipt status 실패 처리

### QA-3-1: 배포 실패 시 failed 저장
- [x] 의도적으로 revert되는 컨트랙트 배포 시도 (예: constructor에서 require(false))
- [x] 대시보드에서 status가 "failed"로 표시되는지 확인
- [x] Supabase deployments 테이블에서 status='failed', error 메시지 확인

### QA-3-2: 액션 실행 실패 시 failed 저장
- [x] 배포된 컨트랙트에서 revert되는 write 함수 실행 (예: 잔액 없이 transfer)
- [x] ContractActionPanel에서 에러 메시지 표시 확인
- [x] Supabase contract_actions 테이블에서 status='failed' 확인

### QA-3-3: 정상 케이스 회귀
- [x] 정상 배포 (Proxy ON) → status='success' 확인
- [x] 정상 배포 (Proxy OFF) → status='success' 확인
- [x] 정상 write 함수 실행 → status='success' + 이벤트 파싱 확인

---

## P2: 배열 타입 파라미터 입력 UI

### QA-P2-1: address[] 입력
- [x] ArrayTester의 setWhitelist(address[]) 선택
- [x] "+" 버튼으로 address 항목 추가 (3개)
- [x] 각 항목에 유효한 address 입력
- [x] 항목 삭제 버튼으로 중간 항목 삭제 → 나머지 유지 확인
- [x] 실행 버튼 활성화 확인 (canExecute 통과)
- [x] MetaMask 서명 → tx 성공 확인
- [x] WhitelistUpdated 이벤트 UI 표시 확인

### QA-P2-2: uint256[] 입력
- [x] setScores(uint256[]) 파라미터가 있는 함수 선택
- [x] 항목 추가 → 숫자값 입력
- [x] 실행 → tx 성공 확인

### QA-P2-3: 빈 배열 / 단일 항목
- [x] 배열 항목 0개 상태에서 실행 → Solidity 측에서 유효 (빈 배열 전송 가능)
- [x] 배열 항목 1개만 입력 후 실행 가능 확인
- 참고: 빈 배열은 앱 레벨 차단 없음 — Solidity에서 유효하므로 허용 방침

### QA-P2-4: 유효성 검사
- [x] address[] 필드에 잘못된 주소 입력 → 빨간 테두리 + 실행 버튼 비활성화 확인
- [x] uint256[] 필드에 문자열 입력 → 실행 버튼 비활성화 확인
- [x] 빈 항목이 하나라도 있으면 실행 불가 확인

### QA-P2-5: tuple[] 비활성화
- [ ] tuple[] 파라미터가 있는 함수 → 해당 파라미터가 disabled 표시 확인
- [ ] 해당 함수 실행 불가 상태 확인
- 참고: ArrayTester에 tuple[] 함수 없음 — 별도 컨트랙트 필요, 미검증

---

## P1 회귀: 이벤트 파싱

### QA-P1-R1: 이벤트 표시 회귀
- [x] setWhitelist 실행 → WhitelistUpdated 이벤트 UI 표시 확인 (QA-P2-1 중 확인)
- [x] 이벤트 내 address가 Explorer 링크로 렌더링 확인

---

## 기존 기능 회귀

### QA-REG-1: 배포 플로우
- [ ] .sol 업로드 배포 (Proxy ON) — 정상 완료
- [ ] .sol 업로드 배포 (Proxy OFF) — 정상 완료
- [ ] 템플릿 배포 (ERC20) — 정상 완료
- [ ] 템플릿 배포 (LiquidityPool) — 정상 완료
- [ ] 배포 결과 → Supabase 저장 확인
- [ ] 배포 결과 → GitHub push 확인

### QA-REG-2: 컨트랙트 관리
- [ ] 배포 이력 카드에서 "관리" 버튼 클릭 → ContractActionPanel 표시
- [x] read 함수 호출 정상 → ISSUE-5 발견 (read 함수 미표시)
- [x] write 함수 (일반 파라미터) 실행 정상

---

## 완료 기준

- [x] ISSUE-3 QA 전체 PASS
- [x] P2 배열 UI QA PASS (QA-P2-5 제외 — tuple 컨트랙트 미검증)
- [x] P1 회귀 PASS
- [ ] QA-REG-1 배포 플로우 회귀 (미완료)
- [ ] QA-P2-5 tuple[] disabled 확인 (미완료)
- [x] vitest 84/84 PASS (자동 테스트)
- [ ] tsc + eslint clean
- [x] TODOS.md 최종 업데이트

---

## 발견된 신규 이슈

| 이슈 | 설명 | 등록 |
|---|---|---|
| ISSUE-5 | ContractActionPanel에서 read(view/pure) 함수 미표시 | TODOS.md 등록 완료 |
