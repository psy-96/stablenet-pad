# SPEC.md — stablenet-pad 상세 구현 참고

> 이 파일은 CLAUDE.md의 상세 구현 내용을 담은 참고 문서다.
> 핵심 아키텍처와 금지 규칙은 CLAUDE.md를 우선한다.

---

## wagmi StableNet 체인 설정

`lib/wagmi.ts`:

```typescript
import { defineChain } from 'viem'
import { createConfig, http } from 'wagmi'
import { metaMask } from 'wagmi/connectors'

export const stablenetTestnet = defineChain({
  id: 8283,
  name: 'StableNet Testnet',
  nativeCurrency: { decimals: 18, name: 'WKRC', symbol: 'WKRC' },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL!] },
  },
  blockExplorers: {
    default: {
      name: 'StableNet Explorer',
      url: process.env.NEXT_PUBLIC_EXPLORER_URL!,
    },
  },
})

export const wagmiConfig = createConfig({
  chains: [stablenetTestnet],
  connectors: [metaMask()],
  transports: { [stablenetTestnet.id]: http() },
})
```

---

## Hardhat 설정

`hardhat.config.ts` (프로젝트 루트):

```typescript
import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      { version: '0.8.20' },
      { version: '0.8.24' },
    ],
  },
  networks: {
    'stablenet-testnet': {
      url: process.env.NEXT_PUBLIC_STABLENET_RPC || 'https://api.test.stablenet.network',
      chainId: 8283,
      accounts: [], // 배포는 브라우저 MetaMask에서 처리 — 서버 측 계정 불필요
    },
  },
}
export default config
```

- Hardhat은 **컴파일 전용**으로만 사용
- 배포 트랜잭션 전송은 프론트엔드 wagmi/viem이 담당
- `hardhat compile` 결과물은 프로젝트 루트 `artifacts/` 디렉토리에 저장

### Hardhat 컴파일 실행 위치
- 반드시 **프로젝트 루트**에서 실행
- `lib/hardhat.ts`에서 `child_process.exec('npx hardhat compile', { cwd: process.cwd() })` 형태로 실행

---

## 패키지 설치 명령어

```bash
npm install wagmi viem @tanstack/react-query
npm install @supabase/supabase-js
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts-upgradeable
```

---

## SSE 이벤트 목록 및 Phase별 역할

### Phase 1 — 서버 SSE (서버 → 브라우저)
| 이벤트 | 데이터 |
|---|---|
| `compiling` | `{ message: "컨트랙트 컴파일 중..." }` |
| `compiled` | `{ message: "컴파일 완료", abi: [...], bytecode: "0x..." }` |
| `error` | `{ message: "에러 메시지" }` → **SSE 종료** |

### Phase 2 — 프론트엔드 로컬 상태 (useState로 로그 배열에 직접 추가)
| 상태 | 로그 메시지 |
|---|---|
| MetaMask 서명 요청 | "MetaMask 서명 요청 중..." |
| Implementation 트랜잭션 전송 | "Implementation 배포 트랜잭션 전송 중..." |
| Implementation 컨펌 완료 | `"Implementation 배포 완료: 0x..."` |
| Proxy 트랜잭션 전송 | "Proxy 배포 트랜잭션 전송 중..." |
| Proxy 컨펌 완료 | `"Proxy 배포 완료: 0x..."` |
| 서명 거부 | "배포가 취소되었습니다" |

### Phase 3 — 서버 SSE (서버 → 브라우저)
| 이벤트 | 데이터 |
|---|---|
| `saving` | `{ message: "결과물 저장 중..." }` |
| `done` | `{ message: "배포 완료", githubCommitUrl: "..." }` → **SSE 종료** |
| `error` | `{ message: "에러 메시지" }` → **SSE 종료** |

### SSE 공통 규칙
- `done` 또는 `error` 이벤트 수신 시 클라이언트는 `EventSource.close()` 호출
- 60초 이상 이벤트 없으면 타임아웃 → `error` 이벤트 발송 후 종료
- LogStream UI는 Phase 1/2/3 로그를 하나의 배열로 합쳐서 표시

---

## 결과물 JSON 구조

`deployments/stablenet-testnet/{ContractName}.json`:

```json
{
  "contractName": "KRWToken",
  "type": "ERC20",
  "network": "stablenet-testnet",
  "chainId": 8283,
  "proxyAddress": "0x...",
  "implementationAddress": "0x...",
  "previousProxyAddress": null,
  "abi": [...],
  "txHash": "0x...",
  "blockNumber": 12345,
  "deployedAt": "2025-01-01T00:00:00Z",
  "deployer": "0x..."
}
```

- `previousProxyAddress`: 재배포 시 이전 Proxy 주소, 최초 배포 시 `null`
- 동일 컨트랙트명 재배포 시 덮어쓰기

---

## Supabase 테이블 구조

```sql
create table deployments (
  id uuid default gen_random_uuid() primary key,
  contract_name text not null,
  type text not null check (type in ('ERC20', 'LiquidityPool')),
  proxy_address text,
  implementation_address text,
  previous_proxy_address text,
  tx_hash text,
  block_number integer,
  deployer text,
  network text default 'stablenet-testnet',
  chain_id integer default 8283,
  status text default 'success' check (status in ('success', 'failed')),
  abi jsonb,
  created_at timestamp with time zone default now()
);
create index idx_deployments_contract_name on deployments(contract_name);
create index idx_deployments_created_at on deployments(created_at desc);
```

---

## API 요청/응답 구조

### POST /api/deploy
```json
// Request
{
  "contractType": "ERC20" | "LiquidityPool",
  "fileName": "KRWToken.sol",
  "params": { "name": "KRW Token", "symbol": "KRW", "initialSupply": "1000000" },
  "useProxy": true,
  "deployerAddress": "0x..."
}
// Response
{ "deploymentId": "uuid-v4", "status": "compiled", "bytecode": "0x...", "abi": [...] }
```

### POST /api/deploy/confirm
```json
// Request — txHash만 넘기면 서버가 waitForTransactionReceipt로 proxyAddress/blockNumber 추출
{
  "deploymentId": "uuid-v4",
  "contractName": "KRWToken",
  "contractType": "ERC20",
  "txHash": "0x...",          // 최종 tx (proxy 또는 단순 배포)
  "implAddress": "0x...",     // Proxy 배포 시 Implementation 주소, 단순 배포 시 null
  "deployerAddress": "0x...",
  "abi": [...]
}
// Response
{
  "success": true,
  "githubCommitUrl": "https://github.com/...",
  "proxyAddress": "0x...",
  "blockNumber": 12345
}
```

### GET /api/template
```
// Request
GET /api/template?type=LiquidityPool

// Response
{ "tempPath": "/tmp/contracts/{deploymentId}/LiquidityPool.sol", "deploymentId": "uuid-v4" }
```

LiquidityPool 배포 시 파일 업로드 대신 이 엔드포인트를 호출해 서버 번들 템플릿 경로를 받는다.

### GET /api/deployments
```json
// Response
{
  "deployments": [
    {
      "id": "uuid",
      "contractName": "KRWToken",
      "type": "ERC20",
      "proxyAddress": "0x...",
      "txHash": "0x...",
      "deployedAt": "2025-01-01T00:00:00Z",
      "status": "success",
      "deployer": "0x..."
    }
  ]
}
```
