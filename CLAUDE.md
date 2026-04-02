# CLAUDE.md — stablenet-pad

## 프로젝트 개요
스마트컨트랙트를 StableNet 테스트넷에 배포하고 결과물(주소, ABI)을 관리하는 웹 대시보드.
상세 구현 참고: `SPEC.md` | 실행 순서 및 QA: `AGENTS.md` | 기능 명세: `FUNCTIONAL_SPEC.md`

---

## 기술 스택
| 레이어 | 기술 |
|---|---|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript strict mode |
| 스타일링 | Tailwind CSS |
| 지갑 연결 | wagmi v2 + viem |
| DB | Supabase (PostgreSQL) |
| 배포 도구 | Hardhat (컴파일 전용) |
| 코드 품질 | ESLint + Prettier |

---

## 네트워크
| 항목 | 값 |
|---|---|
| Chain ID | 8283 |
| RPC URL | https://api.test.stablenet.network |
| Explorer | https://explorer.stablenet.network |
| 가스 토큰 | WKRC |

---

## 환경변수 (.env.local)
```
NEXT_PUBLIC_CHAIN_ID=8283
NEXT_PUBLIC_RPC_URL=https://api.test.stablenet.network
NEXT_PUBLIC_EXPLORER_URL=https://explorer.stablenet.network
GITHUB_TOKEN=...
GITHUB_OWNER=...
GITHUB_REPO=stablenet-pad
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 핵심 아키텍처: 배포 파이프라인 3단계

```
[Phase 1 — 서버]  POST /api/deploy
  Hardhat compile → bytecode + ABI 반환 → SSE로 로그 스트리밍

[Phase 2 — 브라우저]  wagmi/viem
  viem encodeDeployData → MetaMask 서명 → StableNet 전송 → 컨펌 대기
  (로그는 useState 배열에 직접 추가, SSE 아님)

[Phase 3 — 서버]  POST /api/deploy/confirm
  Supabase 저장 → JSON 파일 생성 → GitHub push → SSE done 이벤트
```

**서버/브라우저 역할 분리 — 절대 혼용 금지**
- 서버: Hardhat 컴파일, Supabase 저장, GitHub push만 담당
- 브라우저: MetaMask 서명, 트랜잭션 전송만 담당

---

## MVP 배포 대상
- **ERC20**: `name`, `symbol`, `initialSupply` / OpenZeppelin ERC20Upgradeable 기반
- **LiquidityPool**: `tokenA`(드롭다운), `tokenB`(드롭다운), `fee` / ERC20 먼저 배포 필수

---

## 금지 규칙
- `any` 타입 사용 금지
- 환경변수 하드코딩 금지 — 반드시 `process.env`로 접근
- `SUPABASE_SERVICE_ROLE_KEY` 클라이언트 노출 금지 (`NEXT_PUBLIC_` 접두사 금지)
- `GITHUB_TOKEN`, 프라이빗 키를 코드에 직접 작성 금지
- Hardhat `accounts` 필드에 프라이빗 키 하드코딩 금지
- Hardhat 실행 코드를 `app/api/` 외부(클라이언트)에 작성 금지
- MetaMask 서명 코드를 서버 사이드(`app/api/`)에 작성 금지
- `artifacts/`, `contracts/`, `.env.local` GitHub 커밋 금지
- `console.log` 프로덕션 코드에 잔존 금지
- 공통 타입을 `types/index.ts` 외 분산 정의 금지

---

## 예외 처리 원칙
| 상황 | 처리 |
|---|---|
| MetaMask 미설치 | 설치 링크 안내 |
| 잘못된 네트워크 | Chain ID 8283으로 전환 요청 |
| WKRC 잔액 부족 | 경고 + 배포 버튼 비활성화 |
| 컴파일 오류 | SSE error 이벤트로 로그 전송 |
| MetaMask 서명 거부 | 재시도 버튼 표시 |
| Implementation 성공 후 Proxy 실패 | Implementation 주소 노출 (수동 복구) |
| GitHub push 실패 | JSON 수동 다운로드 버튼 제공 |
| Supabase 저장 실패 | 경고만 표시, 배포는 성공 처리 |
