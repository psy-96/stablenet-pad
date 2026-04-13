# VISION.md — stablenet-pad

> 내부용. 현재 구현 상태와 앞으로 가고 싶은 방향을 정리한 문서.
> 설계 결정의 근거로 쓰고, `/plan-ceo-review` 실행 전 컨텍스트로 활용한다.

---

## 현재 (Phase 2-B 완료, 2026-04-13)

StableNet Testnet(Chain ID 8283) 위에서 스마트컨트랙트를 배포하고
결과물(주소, ABI)을 관리하며 배포 후 운영 액션까지 실행하는 팀 내부 대시보드.

**핵심 가치:** 기획팀이 코드 없이 컨트랙트를 배포하고, 2번 팀(프론트엔드)이
별도 커뮤니케이션 없이 결과물을 바로 가져다 쓸 수 있다.
배포한 컨트랙트의 write 함수도 대시보드에서 직접 실행하고 이력을 남긴다.

**현재 스코프:**
- 템플릿 배포: ERC20, LiquidityPool, SimpleVault → 파라미터 입력 → MetaMask 서명 → 배포
- Generic 배포: 임의 .sol 파일 업로드 → 컴파일 미리보기 → 파라미터 입력 → 배포
- 배포 이력: Supabase 저장 + GitHub 자동 push + 대시보드 조회 + 핀/즐겨찾기
- 운영 액션: ABI write/read 함수 자동 파싱 → UI 생성 → MetaMask 서명 → 실행 → 이력 조회 (contract_actions)
- tuple 파라미터 UI: ABI components 기반 재귀 서브 필드 렌더링
- 외부 컨트랙트 임포트: ABI + 주소 수동 입력 → Pad에서 관리
- V2 메뉴: Factory / Router ContractActionPanel + ERC20 배포 단축
- V3 메뉴: Factory / PositionManager / SwapRouter ContractActionPanel + ERC20 배포 단축
- V3 컨트랙트 배포 완료 (외부 Hardhat → Pad import 패턴)
- UUPS 업그레이드 패턴: 모든 템플릿에 `upgradeTo`/`_authorizeUpgrade` 포함

---

## 왜 이걸 만드나

범용 툴(thirdweb, Remix 등)은 있지만 우리 팀에 맞지 않는 이유:
- StableNet 같은 커스텀 체인은 직접 지원 안 함
- GitHub 자동 push, 팀 배포 이력 공유 등 내부 워크플로우 연동 없음
- 비개발자가 쓰기 어려움
- 배포 후 운영(파라미터 변경, 업그레이드 등) 지원 없음

stablenet-pad는 우리 팀의 워크플로우에 맞게 만든 툴이다.
범용성보다 팀 적합성을 우선한다.

---

## 앞으로 가고 싶은 방향

### Phase 1 — 범용 배포 툴 + 템플릿 라이브러리
> 목표: StableNet 위의 모든 컨트랙트 배포를 커버한다

현재는 ERC20, LP만 지원. 앞으로:
- **범용 배포**: 어떤 .sol 파일이든 업로드 → 배포
- **템플릿 라이브러리**: ERC20, LP V2, LP V3, ERC721, Vault 등 자주 쓰는 컨트랙트를
  파라미터만 입력하면 배포할 수 있도록 번들 제공
- **계약 유형별 UI**: 업로드가 필요한 것(커스텀)과 파라미터만 필요한 것(템플릿)을
  자연스럽게 분기

현재 LP Approach A(내부 템플릿)가 이 방향의 첫 번째 구현이다.
새 계약 유형을 추가할 때마다 같은 패턴을 따른다.

---

### Phase 2 — 운영 액션 레이어 ✅ 완료 (2026-04-08)
> 목표: 배포 후 운영도 대시보드에서 한다

**구현 완료:**
- `abiWriteFunctionsToActions()` — ABI write 함수 자동 파싱 (view/initialize 제외)
- `ContractActionPanel` — Write/Read 탭 분리, 함수 선택 → 파라미터 입력 → 실행 → 이력 탭
- `contract_actions` 테이블 — 실행 이력 Supabase 저장 + 조회 UI
- `useContractAction` hook — MetaMask 서명 → tx → blockNumber → 이력 저장
- UUPS `upgradeTo`/`upgradeToAndCall` — 모든 템플릿에 포함, write 함수로 실행 가능
- 배열 파라미터 UI — `address[]`, `uint256[]` 등 동적 입력
- tuple 파라미터 UI — `tuple` ABI components 기반 재귀 서브 필드 렌더링 (2026-04-13)
- DEX 풀 플로우 검증 완료 — Factory → createPair → addLiquidity → swap (2026-04-10)
- 배포 이력 핀/즐겨찾기 — ⭐ 버튼, 핀된 항목 최상단 고정 (2026-04-13)
- 외부 컨트랙트 임포트 — ABI + 주소 수동 입력 (2026-04-13)
- Read 함수 UI — view/pure 함수 조회 (2026-04-13)
- 액션 이력 조회 UI — contract_actions 탭 (2026-04-13)

---

### Phase 2-B — DEX 인프라 + V2/V3 메뉴 UI ✅ 완료 (2026-04-13)
> 목표: Uniswap V2/V3 컨트랙트 배포 및 운영을 Pad에서 한다

**구현 완료:**
- V2 메뉴 UI — Factory/Router 환경변수 분리, ContractActionPanel 프리셋
- V3 컨트랙트 배포 — 독립 Hardhat 스크립트, pre-compiled artifact + 라이브러리 링킹
- V3 메뉴 UI — Factory/PositionManager/SwapRouter ContractActionPanel + ERC20 단축
- tuple 파라미터 UI — V3 mint/swap struct 입력 지원
- "배포는 어디서든, 관리는 Pad에서" 패턴 검증 (ADR-014)

**다음:**
- V3 풀 플로우 테스트 — createPool → mint → swap 실제 실행 검증

---

### Phase 3 — 배포 이력 시각화 + 온체인 모니터링
> 목표: 언제 누가 뭘 배포했는지, 지금 어떤 상태인지 한눈에 본다

**개선 백로그:**
- **배포 이력 페이지네이션**: 핀 기능으로 부분 해결 — 풀 페이지네이션은 미구현
- **V3 빠른 작업 UI** (백로그): createPool 원클릭, mint/swap 파라미터 가이드
- **V3 풀 플로우 테스트**: Factory → createPool → PositionManager mint → SwapRouter swap

**이력 시각화:**
- **타임라인 뷰**: 배포 이력을 시간순으로 시각화, 재배포 히스토리 추적
- **온체인 상태 모니터링**: 배포된 컨트랙트의 잔액, 주요 이벤트, 트랜잭션 수 실시간 표시
- **알림**: 특정 이벤트 발생 시 Slack/이메일 알림 (예: Pool에 유동성 추가됨)
- **비교 뷰**: 재배포 전후 파라미터 diff 표시

---

### Phase 4 — 멀티시그 배포 승인
> 목표: 프로덕션 배포에 팀 승인 프로세스를 넣는다

지금은 혼자 서명하면 배포 완료. 프로덕션에서는:
- 배포 요청 → 팀 N명 중 M명 승인 → 실행
- Safe(멀티시그 월렛) 연동
- 승인 이력 기록
- 긴급 정지도 동일한 승인 프로세스

테스트넷은 지금처럼 단독 서명, 메인넷은 멀티시그 필수로 분기.

---

### Phase 5 — 컨트랙트 작성 플레이그라운드 + AI 생성
> 목표: 배포 전 단계인 컨트랙트 작성부터 커버한다

지금은 외부에서 만들어온 .sol 파일을 받아서 배포한다.
앞으로는 이 툴 안에서 작성부터 시작할 수 있어야 한다:
- **브라우저 IDE**: Solidity 에디터 (Remix 수준), 실시간 컴파일 오류 표시
- **AI 생성**: "ERC20 토큰 만들어줘, 이름 KRWToken, 공급량 100만" → Claude가 .sol 작성
- **템플릿 편집**: 번들 템플릿을 기반으로 수정해서 배포
- **작성 → 테스트 → 배포** 원스톱 플로우

AI 생성은 Claude API 연동으로 구현. 생성된 코드는 반드시 사람이 검토 후 배포.

---

## 로드맵 요약

| Phase | 내용 | 상태 |
|---|---|---|
| MVP | ERC20 + LP 배포, 이력 관리 | ✅ 완료 (2026-04-02) |
| Phase 1 | 범용 배포 + 템플릿 라이브러리 (1-A Registry + 1-B Generic Upload) | ✅ 완료 (2026-04-08) |
| Phase 2 | 운영 액션 레이어 (ContractActionPanel + contract_actions) | ✅ 완료 (2026-04-08) |
| Phase 2-B | DEX 인프라 + V2/V3 메뉴 UI + 이슈 해결 | ✅ 완료 (2026-04-13) |
| Phase 3 | 이력 시각화 + V3 풀 플로우 테스트 | 진행 예정 |
| Phase 4 | 멀티시그 배포 승인 | 미시작 |
| Phase 5 | 플레이그라운드 + AI 컨트랙트 생성 | 미시작 |

Phase 3은 Phase 2-B와 병렬 진행 가능.

---

## 하지 않을 것 (명시적 Out of Scope)

- **메인넷 배포**: 테스트넷 검증 완료 전까지 없음
- **타 체인 지원**: StableNet 외 체인 확장은 Phase 1 이후 별도 검토
- **외부 공개**: 팀 내부 툴로 유지. 오픈소스/SaaS화는 고려하지 않음
- **스마트 컨트랙트 감사**: 배포 툴이지 감사 툴이 아님. 감사는 CertiK 등 외부에 의존

---

## 기술 방향성

- 현재 스택(Next.js + wagmi + Hardhat + Supabase) 유지
- Phase 5 AI 생성: Anthropic API (Claude) 직접 연동
- Phase 3 모니터링: viem `watchContractEvent` 또는 The Graph
- Phase 4 멀티시그: Safe SDK 연동
- 에이전트 확장: 단일 에이전트 → Deploy / QA / GitHub 서브에이전트 분리
  (AGENTS.md 향후 확장 계획 참고)