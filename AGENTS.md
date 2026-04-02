# AGENTS.md — stablenet-pad

## 에이전트 역할

이 파일은 Claude Code가 자율적으로 개발과 QA를 반복하며 결과물을 완성하기 위한 행동 지침이다.
프로젝트 정보는 `CLAUDE.md`를 참고한다.

---

## 자율 실행 원칙

- 사람의 개입 없이 개발 → 검증 → 수정 사이클을 스스로 반복한다
- 막히는 부분이 생기면 멈추지 말고, 가능한 대안을 스스로 찾아서 계속 진행한다
- 한 기능을 완성한 후 반드시 자가 QA를 수행하고 다음 기능으로 넘어간다
- 모든 작업은 아래 **실행 순서**를 따른다

---

## 배포 파이프라인 (완료 ✓)

MVP Step 1~12 전체 완료 (2026-04-02). 아래는 아키텍처 참고용.

```
[Phase 1 — 서버]
  ERC20:          POST /api/upload → POST /api/deploy (Hardhat compile)
  LiquidityPool:  GET /api/template → POST /api/deploy (번들 템플릿 컴파일)

[Phase 2 — 브라우저]
  viem encodeDeployData → MetaMask 서명 → StableNet 전송

[Phase 3 — 서버]
  POST /api/deploy/confirm
  → waitForTransactionReceipt → Supabase INSERT → GitHub PUT → SSE done
```

**서버/브라우저 역할 분리 — 절대 혼용 금지**
- 서버: Hardhat 컴파일, Supabase 저장, GitHub push
- 브라우저: MetaMask 서명, 트랜잭션 전송

---

## Step 12. 전체 통합 QA (완료 ✓ 2026-04-02)

모든 항목 PASS. 상세 결과는 `TODOS.md` 참고.

---

## 자가 QA 기준

각 Step QA 항목 외에, 모든 기능에 공통으로 적용한다.

### 코드 품질
- TypeScript 컴파일 오류 없음 (`npx tsc --noEmit`)
- ESLint 오류 없음 (`npx eslint .`)
- `any` 타입 사용 없음

### 보안
- `SUPABASE_SERVICE_ROLE_KEY`가 클라이언트 사이드 코드에 노출되지 않음
- `.env.local`이 git status에 포함되지 않음

### 아키텍처
- Hardhat 실행 코드가 서버 사이드(`app/api/`)에만 존재함
- MetaMask 서명 코드가 클라이언트 사이드(`components/`)에만 존재함

---

## 완료 기준 (Definition of Done)

- [x] Step 1 ~ Step 12 모든 체크리스트 통과 (2026-04-02)
- [x] `npx tsc --noEmit` 오류 없음
- [x] `npx eslint .` 오류 없음
- [ ] ERC20 토큰이 StableNet Testnet Explorer에서 확인됨
- [ ] LiquidityPool이 StableNet Testnet Explorer에서 확인됨
- [ ] GitHub `stablenet-pad/deployments/stablenet-testnet/` 에 JSON 파일 존재
- [ ] Supabase `deployments` 테이블에 배포 이력 존재
- [ ] 웹 대시보드에서 배포 이력 조회 가능

---

## 막혔을 때 행동 지침

| 상황 | 행동 |
|---|---|
| 패키지 설치 오류 | 대안 패키지 검색 후 설치 시도 |
| TypeScript 타입 오류 | 타입 정의 수정, `as` 캐스팅은 최후 수단 |
| Hardhat 컴파일 오류 | Solidity 버전 확인, import 경로 확인 |
| SSE 연결 문제 | Next.js App Router SSE 구현 방식 재확인 |
| wagmi/viem API 오류 | 버전 호환성 확인 후 공식 문서 기준으로 수정 |
| StableNet RPC 응답 없음 | 30초 대기 후 재시도, 3회 실패 시 에러 처리 |

---

## 향후 확장 계획 (참고용)

현재는 단일 에이전트로 실행. 추후 아래 구조로 확장 예정:

```
Orchestrator Agent
  ├── Deploy Agent      (배포 파이프라인 담당)
  ├── QA Agent          (자가 검증 담당)
  └── GitHub Agent      (결과물 관리 담당)
```

이 파일(AGENTS.md)이 확장 시 오케스트레이터 지침 파일이 된다.
