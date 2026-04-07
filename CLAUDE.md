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

## 진행 현황 (2026-04-07)
| 단계 | 상태 |
|---|---|
| MVP (ERC20 + LiquidityPool 배포 대시보드) | ✅ 완료 |
| Phase 1-A (Template Registry + TemplateCatalog + ContractParamsForm 리팩터링) | ✅ 완료 |
| Phase 1-A QA 버그 픽스 (오늘) | ✅ 완료 |
| Phase 1-B (Generic Upload 2단계 흐름) | ⏳ QA Scene 2~4 통과 후 시작 |

### Phase 1-A QA 버그 픽스 완료 (2026-04-07)
| 항목 | 픽스 내용 |
|---|---|
| Hardhat sources 범위 | `contracts/templates/` 만으로 제한 — `examples/` 컴파일 제외 |
| OZ v5 호환 | `ReentrancyGuardUpgradeable` 제거됨 — `SimpleVault.sol` inline `_locked` guard로 대체 |
| artifact 경로 | `contractName` ≠ 내부 contract 이름 대응 — `readdir`로 JSON 탐색 |
| `_tmp_` prefix | 컴파일 임시 파일이 기존 템플릿 원본 덮어쓰는 버그 방지 |
| ERC20 재배포 오탐 | 템플릿 배포 전체 재배포 감지 제외 — 업로드 모드 전용으로 변경 |
| LP 파라미터 키 | registry keys `_tokenA`, `_tokenB`, `_fee` (Solidity ABI 기준) |
| 잔액 조회 fallback | RPC 실패 시 `"- WKRC"` 표시 (`isError` + `chainId` 명시) |
| 수수료 필드 hint | `TemplateParam.hint` 필드 추가 — LP fee에 `500/3000/10000` 설명 |
| GitHub push 경로 | `deployments/stablenet-testnet/{type}/{name}_{addr8}.json` |
| GitHub push 파일명 | `{contractName}_{proxyAddress 앞 8자리}.json` — 재배포 충돌 방지 |
| Hardhat/OZ deps | `hardhat`, `@nomicfoundation/hardhat-toolbox` → `dependencies`로 이동 |

---

## 다음 작업 (2026-04-08)
1. Railway 재배포 후 QA Scene 2~4 완료
2. QA 전체 통과 후 Phase 1-B `/plan-eng-review` 시작
3. VISION.md Phase 2에 "배포 결과 저장 경로 커스터마이징" 추가

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
