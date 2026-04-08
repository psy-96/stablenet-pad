# CLAUDE.md — stablenet-pad

## 프로젝트 개요
스마트컨트랙트를 StableNet 테스트넷에 배포하고 결과물(주소, ABI)을 관리하는 웹 대시보드.
상세 구현 참고: `SPEC.md` | 실행 순서 및 QA: `AGENTS.md` | 기능 명세: `FUNCTIONAL_SPEC.md`

---

## 배포 환경
| 항목 | 값 |
|---|---|
| 플랫폼 | Railway |
| 프로덕션 URL | https://stablenet-pad-production.up.railway.app |
| 배포 트리거 | GitHub `main` push → 자동 재배포 |
| 특이사항 | `NODE_TLS_REJECT_UNAUTHORIZED=0` Railway 환경변수에 설정됨 (StableNet RPC TLS 우회) |

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

## 환경변수 (.env.local / Railway)
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
NODE_TLS_REJECT_UNAUTHORIZED=0   # Railway 전용 — 로컬 .env.local에는 추가하지 말 것
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

## 템플릿 목록 (contracts/templates/)
| 템플릿 | params (ABI 키) | 비고 |
|---|---|---|
| ERC20 | `name`, `symbol`, `initialSupply` | OZ ERC20Upgradeable |
| LiquidityPool | `_tokenA`, `_tokenB`, `_fee` | ERC20 2개 이상 배포 필수 |
| SimpleVault | `owner_` | ETH custody, inline reentrancy guard |

새 템플릿 추가: `contracts/templates/{Name}.sol` + `lib/template-registry.ts` 엔트리 1줄

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

## 진행 현황 (2026-04-08)
| 단계 | 상태 |
|---|---|
| MVP (ERC20 + LiquidityPool 배포 대시보드) | ✅ 완료 |
| Phase 1-A (Template Registry + TemplateCatalog + ContractParamsForm 리팩터링) | ✅ 완료 |
| Phase 1-A QA 버그 픽스 | ✅ 완료 |
| Phase 1-B (Generic Upload 2단계 흐름 + GenericDeploySection) | ✅ 완료 |
| Phase 2 (운영 액션 레이어 — ContractActionPanel + contract_actions) | ✅ 완료 |

### Phase 2 완료 항목 (2026-04-08)
| 항목 | 내용 |
|---|---|
| UUPS 패턴 추가 | 3개 템플릿 모두 `UUPSUpgradeable` 상속 + `_authorizeUpgrade(onlyOwner)` |
| OZ v5 호환 | `__UUPSUpgradeable_init()` 제거 (v5에서 삭제됨) |
| `types/index.ts` | `ActionParamType`, `ActionParam`, `ActionFunctionDef`, `ActionConfirmRequest/Response` 추가 |
| `abiWriteFunctionsToActions()` | ABI write 함수 파싱 → `ActionFunctionDef[]` (initialize/view 제외) |
| `supabase/migrations/` | `contract_actions` 테이블 마이그레이션 SQL |
| `POST /api/actions/confirm` | 운영 액션 이력 Supabase INSERT |
| `useContractAction` hook | MetaMask 서명 → tx 전송 → blockNumber 추출 → 이력 저장 |
| `ContractActionPanel` | write 함수 선택 → 파라미터 입력 (bool/uint/address/string/raw-hex/disabled) → 실행 → 로그 |
| `DeployHistory` | "관리" 버튼 추가 (`onManageDeployment` callback) |
| `page.tsx` | `managedDeployment` state — 오른쪽 패널 ActionPanel/ResultPanel 분기 |
| 배포 이력 태그 | 템플릿 → 기존 type 표시, Generic → "General" 태그 통일 |
| 테스트 | vitest 53/53 PASS (`abiWriteFunctions` 15케이스 포함) |

---

## 오픈 이슈 (2026-04-08)
| 이슈 | 설명 |
|---|---|
| 액션 이력 UI | `contract_actions` 테이블 데이터를 대시보드에서 조회하는 뷰 미구현 |
| CertiK Explorer verification | 배포된 컨트랙트 소스코드 검증 플로우 미정 |
| Supabase 마이그레이션 수동 실행 필요 | `supabase/migrations/20260408_contract_actions.sql` Dashboard SQL Editor에서 실행 |

---

## 다음 작업 (Phase 2-B)
1. DEX 배포 시나리오 구체화 (ERC20 2개 + LiquidityPool + 유동성 공급 액션 end-to-end)
2. 액션 이력 조회 UI — `contract_actions` 테이블 → 선택 컨트랙트의 실행 이력 표시
3. `/plan-eng-review` 실행 후 Phase 2-B 범위 확정

---

## Phase 1 설계 결정 (2026-04-07)

| 항목 | 결정 |
|---|---|
| 템플릿 관리 | `lib/template-registry.ts` 중앙 집중 — 새 템플릿은 registry에만 추가 |
| Generic 배포 UX | 업로드 → 컴파일 미리보기 → 파라미터 입력 → 배포 (2단계) |
| Proxy 감지 | ABI에서 `initialize()` 존재 시 경고 표시, 토글은 사용자가 직접 제어 |
| `contractType` 타입 | `string`으로 확장 — 템플릿은 registry id, Generic은 컨트랙트 파일명 |
| Supabase `type` 컬럼 | check constraint DROP — 앱 레벨 registry 조회로 검증 대체 |
| 개발 순서 | Phase 1-A (Template Registry + Catalog) → Phase 1-B (Generic Upload) |
| 테스트 프레임워크 | Vitest + `@vitejs/plugin-react` + jsdom |
| `ContractParamsForm` props | `contractType` 대신 `TemplateParam[]` 수신 (Phase 1-A 리팩터링 시) |
| `encodeInitData` | contractType switch 제거 → ABI input.type 기반 동적 인코딩 |
| address-select 옵션 로딩 | registry에 `fetchUrl` 문자열만 정의, 실제 fetch는 컴포넌트에서 |

---

## Phase 2 설계 결정 (2026-04-08)

| 항목 | 결정 |
|---|---|
| ABI 파싱 위치 | `lib/template-registry.ts` — `abiWriteFunctionsToActions()` 순수 함수, 서버/클라이언트 공용 |
| 타입 분류 | `classifyAbiType()` — bool/address/uint*/int*/bytes* 개별 분기, tuple 등 복합 → `disabled` |
| 트랜잭션 전송 | `useContractAction` hook — wagmi `sendTransactionAsync` + viem `encodeFunctionData` |
| Receipt 대기 | 기존 `/api/tx/wait` 재사용 (deploy와 동일 패턴) |
| 이력 저장 | `POST /api/actions/confirm` → `contract_actions` 테이블. 온체인 완료 후 실패 시 경고만 |
| 배포 이력 태그 | `getTemplateById(d.type)` 존재 여부로 분기 — 없으면 "General" |
| 오른쪽 패널 분기 | `managedDeployment` state null 여부 — null이면 ResultPanel, 아니면 ContractActionPanel |

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
