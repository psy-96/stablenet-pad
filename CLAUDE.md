# CLAUDE.md — stablenet-pad

## 프로젝트 개요
스마트컨트랙트를 StableNet 테스트넷에 배포하고 결과물(주소, ABI)을 관리하는 웹 대시보드.
참고 문서: `SPEC.md`(API 구조) | `AGENTS.md`(실행 지침) | `FUNCTIONAL_SPEC.md`(기능 명세) | `TODOS.md`(현재 상태) | `DECISIONS.md`(ADR 이력)

---

## 기술 스택
Next.js 14 (App Router) · TypeScript strict · Tailwind CSS · wagmi v2 + viem · Supabase (PostgreSQL) · Hardhat (컴파일 전용) · Vitest · ESLint + Prettier

## 네트워크 (StableNet Testnet)
Chain ID: 8283 · RPC: `https://api.test.stablenet.network` · Explorer: `https://explorer.stablenet.network` · Gas: WKRC

## 배포 환경
Railway · URL: `https://stablenet-pad-production.up.railway.app` · GitHub `main` push → 자동 재배포
Railway 환경변수: `NODE_TLS_REJECT_UNAUTHORIZED=0` (StableNet RPC TLS 우회)

---

## 핵심 아키텍처: 배포 파이프라인

```
[서버] POST /api/deploy → Hardhat compile → bytecode+ABI 반환 (SSE 스트리밍)
[브라우저] viem encodeDeployData → MetaMask 서명 → StableNet 전송 → 컨펌 대기
[서버] POST /api/deploy/confirm → Supabase 저장 → GitHub push → SSE done
```

**서버/브라우저 역할 분리 — 절대 혼용 금지**
- 서버: Hardhat 컴파일, Supabase 저장, GitHub push
- 브라우저: MetaMask 서명, 트랜잭션 전송

---

## 템플릿 (contracts/templates/)
| 템플릿 | constructor params | 비고 |
|---|---|---|
| ERC20 | `name`, `symbol`, `initialSupply` | OZ ERC20Upgradeable + UUPS |
| LiquidityPool | `_tokenA`, `_tokenB`, `_fee` | ERC20 2개 이상 배포 필수 |
| SimpleVault | `owner_` | ETH custody, inline reentrancy guard |

새 템플릿 추가: `contracts/templates/{Name}.sol` + `lib/template-registry.ts` 엔트리 1줄

---

## 금지 규칙
- `any` 타입 사용 금지
- 환경변수 하드코딩 금지 — 반드시 `process.env`로 접근
- `SUPABASE_SERVICE_ROLE_KEY` 클라이언트 노출 금지 (`NEXT_PUBLIC_` 접두사 금지)
- `GITHUB_TOKEN`, 프라이빗 키를 코드에 직접 작성 금지
- Hardhat 코드를 `app/api/` 외부(클라이언트)에 작성 금지
- MetaMask 서명 코드를 서버 사이드(`app/api/`)에 작성 금지
- `artifacts/`, `contracts/`, `.env.local` GitHub 커밋 금지
- `console.log` 프로덕션 코드에 잔존 금지
- 공통 타입을 `types/index.ts` 외 분산 정의 금지

---

## 테스트 실행 규칙
- `npx vitest run` 사용. timeout 2분. 2분 안에 안 끝나면 멈추고 원인 보고
- 같은 커맨드 3회 이상 반복 실행 금지 — 실패하면 원인부터 분석
- vitest hang 시 `npx vitest run --no-threads` 시도
- 모든 변경 후 `tsc --noEmit && npx eslint . && npx vitest run` 순서로 검증
- scripts/ 폴더는 Hardhat 전용 — Next.js 빌드(tsconfig)에서 exclude

---

## 설계 결정 요약
| 영역 | 결정 |
|---|---|
| 템플릿 관리 | `lib/template-registry.ts` 중앙 집중 |
| Generic 배포 | 업로드 → 컴파일 미리보기 → 파라미터 → 배포 (2단계) |
| Proxy 감지 | ABI `initialize()` 존재 시 경고, 토글은 사용자 제어 |
| `contractType` | `string` — 템플릿은 registry id, Generic은 파일명 |
| ABI 파싱 | `abiWriteFunctionsToActions()` 순수 함수, 서버/클라이언트 공용 |
| 타입 분류 | `classifyAbiType()` — bool/address/uint*/int*/bytes*/array 개별, tuple → `disabled` |
| 트랜잭션 전송 | `useContractAction` hook — wagmi `sendTransactionAsync` + viem `encodeFunctionData` |
| Receipt 대기 | `/api/tx/wait` (deploy와 action 공용) |
| 이력 저장 | `POST /api/actions/confirm` → `contract_actions` 테이블 |
| 오른쪽 패널 | `managedDeployment` null → ResultPanel, 아니면 ContractActionPanel |

---

## 예외 처리 원칙
| 상황 | 처리 |
|---|---|
| MetaMask 미설치 | 설치 링크 안내 |
| 잘못된 네트워크 | Chain ID 8283 전환 요청 |
| WKRC 잔액 부족 | 경고 + 배포 버튼 비활성화 |
| 컴파일 오류 | SSE error 이벤트 |
| MetaMask 거부 | 재시도 버튼 |
| Impl 성공 후 Proxy 실패 | Implementation 주소 노출 (수동 복구) |
| GitHub push 실패 | JSON 수동 다운로드 |
| Supabase 실패 | 경고만, 배포는 성공 처리 |