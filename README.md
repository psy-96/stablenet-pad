# stablenet-pad

StableNet 테스트넷(Chain ID 8283)에 스마트컨트랙트를 배포하고 결과물(주소, ABI)을 관리하는 웹 대시보드.

MetaMask로 서명하고, 서버가 컴파일하고, 결과물이 Supabase + GitHub에 자동 기록된다.

---

## 빠른 시작

```bash
# 의존성 설치
npm install

# 환경변수 설정 (.env.local)
# NEXT_PUBLIC_CHAIN_ID, NEXT_PUBLIC_RPC_URL, NEXT_PUBLIC_EXPLORER_URL
# GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 개발 서버 실행
npx next dev
```

http://localhost:3000 에서 확인.

---

## 배포 파이프라인

```
[Phase 1 — 서버]  POST /api/upload + /api/deploy
  Hardhat compile → bytecode + ABI 반환

[Phase 2 — 브라우저]  wagmi/viem
  encodeDeployData → MetaMask 서명 → StableNet 전송

[Phase 3 — 서버]  POST /api/deploy/confirm
  waitForTransactionReceipt → Supabase 저장 → GitHub push
```

ERC20은 .sol 파일 직접 업로드. LiquidityPool은 서버 번들 템플릿(`contracts/templates/LiquidityPool.sol`)으로 자동 컴파일 — 파일 업로드 불필요.

---

## 지원 컨트랙트

| 유형 | 파라미터 | 배포 방식 |
|---|---|---|
| ERC20 | name, symbol, initialSupply | .sol 파일 업로드 |
| LiquidityPool | tokenA, tokenB, fee | 내부 템플릿 자동 사용 |

모든 컨트랙트는 ERC1967 Proxy 패턴(기본값)으로 배포되며, 단순 배포(Proxy OFF)도 지원.

---

## 주요 기능

- MetaMask 연결 / Chain ID 8283 자동 전환
- ERC20 .sol 파일 업로드 + Hardhat 컴파일
- LiquidityPool 파라미터 입력 → 표준 템플릿 자동 배포
- 배포 로그 실시간 스트리밍 (SSE)
- Supabase deployments 테이블에 이력 저장
- GitHub `deployments/stablenet-testnet/` 에 JSON 자동 push
- 재배포 감지 + previousProxyAddress 보존
- 배포 이력 조회 + 결과 패널 (ABI 보기, JSON 다운로드)

---

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript strict |
| 스타일링 | Tailwind CSS |
| 지갑 연결 | wagmi v2 + viem |
| DB | Supabase (PostgreSQL) |
| 컴파일 | Hardhat (서버사이드 전용) |

---

## 환경변수

```
NEXT_PUBLIC_CHAIN_ID=8283
NEXT_PUBLIC_RPC_URL=https://api.test.stablenet.network
NEXT_PUBLIC_EXPLORER_URL=https://explorer.stablenet.network
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your-org
GITHUB_REPO=stablenet-pad
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 프로젝트 구조

```
app/
  api/
    upload/         # .sol 파일 → tmp 저장
    deploy/         # Hardhat 컴파일
    deploy/confirm/ # Receipt 확인 + Supabase + GitHub
    deploy/stream/  # SSE 로그 스트리밍
    template/       # 번들 템플릿 제공 (LP)
    tx/wait/        # 서버사이드 receipt 대기
    deployments/    # 이력 조회
  page.tsx
components/
  Header.tsx        # MetaMask 연결
  DeployPanel.tsx   # 파일 업로드 / 파라미터 입력
  ContractParamsForm.tsx
  LogStream.tsx     # 실시간 로그
  ResultPanel.tsx   # 배포 결과
  DeployHistory.tsx # 배포 이력
hooks/
  useDeploy.ts      # 3-phase 배포 파이프라인
lib/
  wagmi.ts          # StableNet 체인 설정
  hardhat.ts        # 컴파일 유틸
  github.ts         # GitHub Contents API
  supabase/         # server / client 분리
  viem-server.ts    # 서버사이드 publicClient
  sse-emitter.ts    # SSE EventEmitter
  erc1967proxy.ts   # Proxy ABI + bytecode
contracts/
  templates/
    LiquidityPool.sol  # 표준 LP 템플릿
types/
  index.ts          # 공통 타입
```

---

## 미래 비전

MVP는 "배포 담당자가 파라미터만 입력하면 컨트랙트가 배포된다"를 증명했다. 다음 단계:

**v1.0 — 컨트랙트 라이브러리 확장**
- ERC721, ERC1155, Vault 등 표준 템플릿 추가
- 템플릿별 파라미터 폼 자동 생성

**v1.5 — 운영 대시보드**
- 배포된 컨트랙트 상태 모니터링 (잔액, 이벤트 로그)
- 긴급 정지 / 파라미터 변경 UI
- 배포 이력 시각화 (타임라인, 주소 변경 추적)

**v2.0 — 팀 협업 + 보안**
- 멀티시그 기반 배포 승인 프로세스
- 비개발자용 배포 인터페이스
- 메인넷 배포 지원

**v2.5 — AI 에이전트 오케스트레이션**
- Claude Code 멀티에이전트: Deploy Agent / QA Agent / GitHub Agent 분리
- 에이전트 간 입출력 표준화 (하네스 엔지니어링)
- 자동화된 배포 후 회귀 테스트
