# DECISIONS.md — stablenet-pad 설계 결정 기록

> 이 문서는 "왜 이렇게 만들었는가"를 기록한다.
> 코드는 what, 커밋 로그는 when, 이 문서는 **why**.

---

## ADR-001: Hardhat을 선택한 이유 (vs Foundry)

**결정:** Hardhat + ethers.js 기반 컴파일/배포 파이프라인

**배경:**
Solidity 컴파일러를 서버에서 돌려야 한다. 선택지는 Hardhat(JS 생태계)과 Foundry(Rust 바이너리).

**이유:**
- stablenet-pad의 서버가 Next.js(Node.js)이므로 Hardhat은 같은 런타임에서 프로그래매틱 호출 가능
- Foundry는 별도 바이너리 설치 + CLI 호출이 필요 → Railway 배포 시 추가 설정 부담
- Hardhat의 `hre.run("compile")` 한 줄로 컴파일 → ABI + bytecode 추출이 깔끔
- 프로젝트 규모에서 Foundry의 장점(빠른 테스트, fuzzing)은 불필요

**트레이드오프:**
- Foundry가 컴파일 속도는 더 빠름 → 현재 규모에서 체감 차이 없음
- Foundry의 forge test는 Solidity로 테스트 작성 → 우리는 컨트랙트 자체를 개발하는 게 아니라 배포 도구를 만드는 거라 해당 없음

---

## ADR-002: 브라우저 서명 + 서버 컴파일 분리 구조

**결정:** 3단계 파이프라인 — 서버 컴파일 → 브라우저 서명 → 서버 저장

**배경:**
스마트컨트랙트 배포에는 (1) Solidity 컴파일, (2) 트랜잭션 서명, (3) 결과 저장이 필요하다.

**이유:**
- 컴파일은 무거움 → 서버에서 Hardhat으로 처리
- 서명은 사용자의 개인키가 필요 → 브라우저의 MetaMask에서만 가능 (개인키를 서버에 보내면 안 됨)
- 결과 저장은 Supabase + GitHub → 서버에서 처리

**핵심 원칙:**
개인키는 절대 서버를 거치지 않는다. 서버는 bytecode를 만들어주고, 브라우저가 서명해서 체인에 보내고, 서버가 결과를 기록한다.

**구현 방식:**
- 서버 → 브라우저: SSE(Server-Sent Events)로 컴파일 진행 상태 스트리밍
- 브라우저 → 체인: viem의 `encodeDeployData` + wagmi의 `sendTransaction`
- 브라우저 → 서버: tx hash를 `/api/deploy/confirm`에 POST → 서버가 receipt 확인 후 저장

**왜 SSE인가:**
- WebSocket 대비 단방향이라 구현 단순
- HTTP 기반이라 Railway 배포에서 별도 설정 불필요
- 컴파일 진행률은 서버→클라이언트 단방향이면 충분

---

## ADR-003: UUPS Proxy 패턴 선택

**결정:** 업그레이드 가능한 컨트랙트는 UUPS(Universal Upgradeable Proxy Standard) 사용

**배경:**
프록시 패턴에는 Transparent Proxy, UUPS, Beacon 등이 있다.

**이유:**
- Transparent Proxy: 배포 시 ProxyAdmin 컨트랙트가 추가로 필요 → 3-tx 배포 (Admin + Impl + Proxy)
- UUPS: 업그레이드 로직이 Implementation에 있어서 2-tx 배포 (Impl + Proxy)만으로 충분
- Beacon: 동일 로직 다수 배포 시 유리 → stablenet-pad 사용 시나리오에 해당 없음

**트레이드오프:**
- UUPS는 Implementation에 `_authorizeUpgrade` 함수를 반드시 포함해야 함 → 사용자가 올리는 .sol에 이게 없으면 프록시 배포 불가
- 현재는 번들 템플릿(ERC20 등)에만 UUPS 적용, 사용자 업로드 .sol은 Proxy ON/OFF 선택 가능

---

## ADR-004: constructor vs initialize 이원화

**결정:** Proxy OFF → constructor, Proxy ON → initialize()

**배경:**
프록시 패턴에서는 constructor가 실행되지 않는다. 프록시가 delegatecall로 Implementation의 로직을 실행하므로, 상태 초기화는 별도의 `initialize()` 함수로 해야 한다.

**이유:**
- ERC20 같은 표준을 직접 배포할 때는 constructor가 자연스러움
- 같은 ERC20을 프록시로 배포하면 constructor 파라미터가 무시됨 → initialize()로 전환 필요
- 사용자가 이 차이를 몰라도 되게, Proxy ON/OFF 토글에 따라 UI가 자동 전환

**학습 포인트:**
"ERC20은 하나의 스펙이다"라고 생각하기 쉽지만, 실제로는 constructor 시그니처가 구현마다 다르다. OpenZeppelin의 ERC20은 `(string name, string symbol)`이지만, 커스텀 구현은 `(string name, string symbol, uint256 initialSupply, address owner)` 등으로 다양하다. UI에서 파라미터 폼을 동적으로 생성하는 이유.

---

## ADR-005: receipt.status 검증을 서버에서 하는 이유

**결정:** `/api/deploy/confirm`, `/api/actions/confirm`에서 receipt.status 검증

**배경:**
ISSUE-3에서 발견 — tx가 revert되어도 Supabase에 success로 저장되는 버그.

**이유:**
- 브라우저에서 `waitForTransactionReceipt`을 호출하면 CORS 문제 발생 (StableNet RPC 특성)
- 따라서 receipt 조회는 서버 사이드에서 수행
- 서버가 receipt을 조회하는 김에 status 검증도 서버에서 하는 게 자연스러움
- `receipt.status === 'reverted'`이면 Supabase에 failed로 저장하고 에러 반환

**학습 포인트:**
viem의 `waitForTransactionReceipt`은 `status: 'success' | 'reverted'`를 반환한다. 하지만 StableNet 같은 커스텀 체인의 RPC는 raw hex(`'0x0'`, `'0x1'`)를 반환할 수 있다. 방어적으로 두 형식 모두 체크.

---

## ADR-006: 배열 파라미터를 타입별로 분류하는 이유

**결정:** `classifyAbiType`에서 `address[]`, `uint256[]` → array, `tuple[]` → disabled

**배경:**
DEX Router의 `swapExactTokensForTokens(uint, uint, address[], address, uint)` 실행을 위해 배열 입력 UI가 필요했다.

**이유:**
- 단순 배열(`address[]`, `uint256[]`, `bool[]`): 원소 타입이 단일 솔리디티 타입 → 동적 입력 필드로 충분
- 복합 배열(`tuple[]`): 각 원소가 여러 필드를 가진 구조체 → 중첩 폼 필요 → 복잡도 대비 사용 빈도 낮음
- Phase 2 스코프에서 tuple[]까지 하면 과다 → 실제 필요 시점(Uniswap V3 대응)에 추가

**UI 설계:**
- `+` 버튼으로 항목 추가, 각 항목에 `×` 버튼으로 삭제
- 입력값은 `encodeArg`에서 배열로 직렬화 → viem에 전달
- `canExecute`에서 빈 항목이나 유효하지 않은 값 체크

---

## ADR-007: Supabase를 선택한 이유 (vs 자체 DB)

**결정:** Supabase (PostgreSQL + REST API + 대시보드)

**배경:**
배포 이력, 액션 로그를 저장할 DB가 필요하다.

**이유:**
- PostgreSQL 기반이라 jsonb, 배열 등 복잡한 데이터 타입 지원
- REST API 자동 생성 → 별도 ORM/쿼리 빌더 불필요
- Table Editor로 데이터 직접 확인 가능 → 개발 중 디버깅에 유리
- Railway에 자체 PostgreSQL 올리면 마이그레이션, 백업 직접 관리해야 함

**트레이드오프:**
- 외부 서비스 의존 → 네트워크 레이턴시 추가
- 무료 티어 한도 있음 → 현재 테스트넷 규모에서 충분

---

## ADR-008: GitHub 자동 push를 넣은 이유

**결정:** 배포 성공 시 ABI + 주소 정보를 GitHub에 자동 push

**배경:**
stablenet-pad의 원래 동기가 "배포 후 팀원이 Slack에서 주소/ABI 물어보는 걸 없애자"였다.

**이유:**
- 대시보드만으로는 개발자가 코드에서 참조하기 불편
- GitHub에 push하면 다른 서비스/스크립트에서 바로 import 가능
- 배포와 동시에 자동 push → 수동 공유 단계 제거

**구조:**
- `contracts/deployed/{chainId}/{contractName}.json` 형태로 저장
- ABI, 주소(proxy/implementation), 배포 시각, 생성자 파라미터 포함

---

## ADR-009: wagmi + viem 조합을 선택한 이유

**결정:** 클라이언트에 wagmi v2 + viem 사용

**배경:**
브라우저에서 MetaMask 연결 + 트랜잭션 전송이 필요하다. 선택지는 ethers.js, web3.js, viem+wagmi.

**이유:**
- viem: TypeScript-first, 타입 안전성 높음, tree-shakeable
- wagmi: React hooks로 지갑 연결/상태 관리가 깔끔 (`useAccount`, `useSendTransaction`)
- ethers.js v6는 괜찮지만 React integration이 wagmi만큼 매끄럽지 않음
- web3.js: 레거시, 번들 사이즈 큼

**학습 포인트:**
wagmi의 지갑 컴포넌트(`ConnectButton` 등)는 SSR에서 hydration mismatch를 일으킨다. `mounted` 패턴으로 해결:
```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return null;
```

---

## ADR-010: 5-State Machine으로 배포 플로우를 관리하는 이유

**결정:** 배포 UI를 idle → uploading → compiling → signing → confirming → done/error 상태 머신으로 관리

**배경:**
배포 과정이 비동기 + 다단계(서버 컴파일 → MetaMask 서명 → 온체인 컨펌)라서, 단순 boolean(`isLoading`)으로는 UI 상태를 정확히 표현할 수 없다.

**이유:**
- 각 단계별로 다른 UI를 보여줘야 함 (로딩 메시지, 버튼 비활성화, 에러 표시)
- 상태 전이가 명확해서 "지금 뭘 기다리는 중인지" 혼동 없음
- 에러 발생 시 어느 단계에서 실패했는지 즉시 파악 가능

**학습 포인트:**
"상태 머신"이라고 하면 거창하지만, 실제로는 `useState<DeployState>('idle')`에 타입을 붙인 것. 핵심은 가능한 상태를 유니온 타입으로 제한해서, "signing 중에 compile 버튼이 눌리는" 같은 불가능한 전이를 타입 레벨에서 차단하는 것.

---

## ADR-011: UniswapV2Factory 배포 실패 원인 (최종 확정 2026-04-10)

**근본 원인:** stablenet-pad의 constructor arg 인코딩 버그.
`hooks/useDeploy.ts`의 `buildConstructorArgs`가 항상 `[]`를 반환하여
constructor arg가 bytecode에 인코딩되지 않았음.

**배경:**
팀원 요청: "Factory랑 Router 직접 배포해서 주소만 알려주실 수 있을까요?" → UniswapV2Factory 배포 시도 → StableNet Testnet에서 지속 실패.

**조사 경과:**

| 단계 | 내용 | 결과 |
|------|------|------|
| 1 | Gas limit 부족 의심 | ❌ MetaMask 36.75M 확인 — 원인 아님 |
| 2 | EIP-170/3860 size 초과 의심 | ❌ 각각 한도 이하 — 원인 아님 |
| 3 | Solidity 버전·evmVersion 호환성 의심 | ❌ 동일 실패 |
| 4 | CREATE2·PUSH0 미지원 의심 | ❌ 정상 동작 확인 |
| 5 | Factory-only 배포 (Pair 미포함) 시도 | ✅ 성공 → 대형 embedded bytecode 가설 |
| 6 | **초기 추정:** StableNet EVM의 대형 initcode 처리 제한 | ❌ 오진 |
| 7 | 메인넷개발팀 답변: "tx 사이즈 제한이 작다" | 별개 사실 — 이번 실패 원인 아님 |
| 8 | Explorer에서 Input Data 확인 | **constructor arg 누락 발견** |
| 9 | `buildConstructorArgs` 수정 후 원본 Factory 배포 | ✅ 성공 |
| 10 | `createPair` (CREATE2, ~19KB Pair) 실행 | ✅ 성공 — 체인 size limit은 이 케이스에서 문제 아님 |

**결론:** Pad 버그 100%. EIP-1167 우회(Light Factory)는 불필요했음.

**버그 내용:**
```typescript
// 수정 전 — params를 완전히 무시하고 빈 배열 반환
function buildConstructorArgs(_contractType, _params): unknown[] {
  return []
}

// 수정 후 — ABI constructor inputs 기반으로 params를 순서대로 매핑
function buildConstructorArgs(abi: Abi, params: ContractParams): unknown[] {
  const ctor = abi.find((item) => item.type === 'constructor')
  // ... inputs를 순서대로 params에서 추출
}
```

OZ Upgradeable 템플릿(빈 constructor)에는 문제가 없어서 오랫동안 발견되지 않았음.
Generic Upload + Proxy OFF 경로에서만 발현.

**교훈:** 체인 탓하기 전에 자기 코드부터 확인.
`eth_estimateGas` 실패나 Explorer Input Data 확인이 조기 진단 포인트였다.

**학습 포인트:**
UniswapV2Factory는 내부에 UniswapV2Pair 전체 bytecode를 상수로 품고 있어서 사실상 "두 컨트랙트를 한 덩어리로 배포"하는 구조다. `_feeToSetter` constructor arg가 없으면 체인이 revert하고, Explorer에서 Input Data가 `0x`이거나 bytecode만 있으면 arg 인코딩 실패를 의심해야 한다.

---

## ADR-012: DEX 풀 플로우 검증 결과 (2026-04-10)

**목적:** stablenet-pad로 Uniswap V2 스타일 DEX 전체 플로우 실행 가능 여부 검증

**검증 순서:**
1. UniswapV2Factory 배포 (Generic Upload, Proxy OFF, constructor: `feeToSetter`)
2. `createPair(tokenA, tokenB)` → PairCreated 이벤트 확인
3. TestToken × 2 배포 (constructor에서 deployer에게 `initialSupply` mint)
4. `approve` × 2 (token → Router)
5. `addLiquidity(tokenA, tokenB, amounts, to, deadline)`
6. `swapExactTokensForTokens(amountIn, amountOutMin, path[], to, deadline)`

**결과:** 전체 성공. AMM 0.3% 수수료 + 가격 영향 정상 반영 (1 TKA → 0.996 TKB).

**Router 변경점:** `UniswapV2Library.pairFor()`에 `INIT_CODE_PAIR_HASH`를 하드코딩 (표준 방식). `INIT_CODE_PAIR_HASH = 0x01849f1b5d62ec92cb6255b91bb5968f5c4084f663ed79eb719d5ce7e07986b1`.

**발견된 Pad 기능 갭:**
- ISSUE-7: 배포 이력 페이지네이션 없음 → 반복 배포 시 과거 컨트랙트 접근 불가
- ISSUE-8: 외부 컨트랙트(Pad 미배포) 관리 불가 → WKRC approve 불가
- ISSUE-9: 대형 uint256 인코딩 이슈 → deadline `9999999999` EXPIRED

---

## ADR-013: 팀원용 DEX 인프라 배포 (2026-04-10)

**배포 완료 주소:**

| 컨트랙트 | 주소 |
|---|---|
| UniswapV2Factory | `0xec1c0fb2ceaa7349b381e5bdd574f6369b4129ce` |
| UniswapV2Router02 | `0xe56c3f0375ec5644509715c42aa8764d4c857d01` |
| WKRC (기존) | `0x0000000000000000000000000000000000001000` |
| INIT_CODE_PAIR_HASH | `0x01849f1b5d62ec92cb6255b91bb5968f5c4084f663ed79eb719d5ce7e07986b1` |

**사양:**
- Uniswap V2 포크, Solidity 0.8.20으로 포팅
- Factory: 표준 구조 (Pair bytecode 내장, CREATE2 사용)
- Router: `pairFor()`에 `INIT_CODE_PAIR_HASH` 하드코딩 (표준 방식)
- Explorer Contract Verification 가능 확인됨

**배포 방법:** stablenet-pad Generic Upload (Proxy OFF) — ISSUE-6 수정 후 가능해짐.

**ABI 파일 팀원에게 공유 완료.**

---

## ADR-014: V3 컨트랙트 배포 방식 — Pad 외부 Hardhat 스크립트 (2026-04-13)

**결정:** Uniswap V3 컨트랙트는 stablenet-pad 외부의 독립 Hardhat 프로젝트(`scripts/v3-deploy/`)로 배포하고, 결과(주소+ABI)만 Pad에 import한다.

**배경:**
V3 컨트랙트(Factory, PositionManager, SwapRouter 등)는 복잡한 라이브러리 링킹이 필요하고, npm 패키지(`@uniswap/v3-core`, `@uniswap/v3-periphery`)는 소스 `.sol`이 아닌 pre-compiled artifact만 제공한다.

**이유:**
- `@uniswap/v3-periphery` npm 패키지는 `.sol` 소스를 제공하지 않아 Hardhat의 일반 컴파일 워크플로우 사용 불가
- `NonfungiblePositionManager`는 `NFTDescriptor` 라이브러리를 링킹해야 함 — `__$hash$__` placeholder를 바이트 오프셋에 따라 수동으로 교체하는 `linkBytecode()` 함수 구현
- Pad의 Generic Upload는 단일 `.sol` 플랫파일 업로드를 가정하므로 이 케이스에 맞지 않음
- 배포는 어디서든 할 수 있다 — 중요한 것은 결과물(주소 + ABI)을 Pad에서 관리할 수 있는 것

**"배포는 어디서든, 관리는 Pad에서" 패턴:**
- 외부 도구로 배포 → 주소 + ABI를 Pad에 import (`POST /api/deployments/import`)
- import된 컨트랙트는 Pad의 ContractActionPanel에서 동일하게 함수 호출 가능
- ISSUE-8(외부 컨트랙트 임포트) 구현이 이 패턴을 가능하게 함

**학습 포인트:**
`NonfungiblePositionDescriptor`의 `linkReferences`에서 `NFTDescriptor` placeholder의 바이트 오프셋을 읽어 정확한 위치에 라이브러리 주소를 삽입해야 한다. offset 1681이 실제 배포에서 확인됨.

---

## ADR-015: tuple 파라미터 UI — ABI components 기반 재귀 렌더링 (2026-04-13)

**결정:** `classifyAbiType`에서 `tuple` 타입을 `'disabled'`에서 `'tuple'`로 해제. ABI `components` 배열 기반으로 서브 필드를 재귀적으로 렌더링.

**배경:**
V3 PositionManager의 `mint(MintParams)`, SwapRouter의 `exactInputSingle(ExactInputSingleParams)` 등 주요 함수가 모두 struct(tuple) 파라미터를 사용한다. tuple이 disabled 상태면 V3 메뉴 UI가 있어도 실질적으로 함수를 실행할 수 없다.

**이유:**
- Uniswap V3의 핵심 함수들이 tuple 파라미터를 사용 → 지원 안 하면 V3 UI가 무의미
- viem은 tuple을 `[val1, val2, ...]` 배열 형식으로 인코딩 → 컴포넌트 순서대로 배열 조립하면 됨
- ABI `components` 필드가 이미 서브 필드 타입 정보를 담고 있어 재귀 렌더링이 자연스럽게 구현됨

**구현 방식:**
- 폼 값 키: `"paramKey.componentKey"` 점 표기법
- `ContractActionPanel`: `p.type === 'tuple'`이면 `p.components`를 순회해 서브 필드 렌더링
- `useContractAction`: `p.type === 'tuple'`이면 components를 순서대로 매핑해 배열 조립
- `canExecute`: tuple 파라미터는 각 component 서브 필드를 개별 검증

**미지원 유지:**
- `tuple[]`: 각 원소가 여러 필드를 가진 배열 → 중첩 동적 폼 필요 → 복잡도 대비 현재 사용 빈도 낮음
- `bytes`, `bytes[]` 등 raw 인코딩 필요한 복합 타입은 `disabled` 유지

---

## ADR-016: V3 풀 플로우 검증 결과 (2026-04-14)

**목적:** stablenet-pad의 tuple 파라미터 UI로 Uniswap V3 전체 플로우 실행 가능 여부 검증

**검증 순서:**
1. V3 Factory `createPool(tokenA, tokenB, fee=3000)` — Pool 컨트랙트 생성
2. V3 Pool `initialize(sqrtPriceX96)` — 초기 가격 세팅 (1:1 기준)
3. ERC20(V3A) `approve(positionManager, amount)` — 유동성 공급 허용
4. ERC20(V3B) `approve(positionManager, amount)` — 유동성 공급 허용
5. PositionManager `mint(MintParams)` — tuple 파라미터 UI로 실행
6. SwapRouter `exactInputSingle(ExactInputSingleParams)` — tuple 파라미터 UI로 실행

**결과:** 전체 성공.
- 1 V3A → 0.996 V3B (0.3% fee 정상 반영)
- swap tx: `0x0d352deee6e2e721a2e14ee8cdb9056e34457c675c9814b403ba2dbfab3fafb0`

**발견된 이슈 및 수정:**
- `abiWriteFunctionsToActions`에서 `initialize()` 함수를 필터링하고 있어 V3 Pool의 `initialize(uint160)` 호출 불가
- 원래 필터 의도: UUPS Proxy의 `initialize()`는 배포 시 이미 호출됨 → Write 탭에 불필요
- 하지만 V3 Pool의 `initialize(sqrtPriceX96)`는 배포 후 반드시 별도 호출이 필요한 함수
- 결정: 필터 제거. UUPS Proxy의 `initialize()`가 Write 탭에 노출되어도 실제로는 호출해봤자 revert되므로 해롭지 않음. 반면 V3 Pool처럼 반드시 호출해야 하는 케이스를 막는 게 더 문제.

**학습 포인트:**
함수 이름만으로 필터링하는 것은 위험하다. `initialize`라는 이름이 UUPS Proxy 패턴에서는 "이미 호출됨"을 의미하지만, V3 Pool에서는 "배포 후 필수 초기화"를 의미한다. 동일한 이름이 다른 의미를 가질 수 있으므로, 이름 기반 필터링보다 컨텍스트가 더 중요하다.

---

## 문서 관리 규칙

- 새로운 설계 결정이 있을 때마다 ADR-NNN 추가
- 결정이 번복되면 기존 ADR에 **[SUPERSEDED by ADR-NNN]** 표기, 삭제하지 않음
- "이유"에는 반드시 "왜 다른 선택지를 안 했는지"(트레이드오프) 포함
- "학습 포인트"는 선택 — 구현 중 알게 된 비자명한 사실이 있을 때만 추가