# StableNet DEX 디버깅 기록

## 목적
UniswapV2Factory 배포 실패(status 0x0) 원인 규명 및 대안 아키텍처 검증.

---

## 테스트 1 — SimpleFactory (Pair 바이트코드 없음)
**날짜:** 2026-04-10
**결론:** ✅ 성공

| 항목 | 값 |
|---|---|
| 컨트랙트 | `SimpleFactory` (Solidity 0.5.16, factory storage/events만, createPair 없음) |
| 배포 주소 | `0xe7C9d14395F9d26Cd12489dadb2ce4f81B50F382` |
| tx hash | `0xb03c65966b37cfe105c7490027feefb931c1d482cfb3fd86ffa88ed16b68db1c` |
| gasUsed | 453,295 |
| status | 1 (success) |
| estimateGas | 458,060 |

**의의:** Factory 로직 자체(storage 쓰기, constructor)는 StableNet에서 문제없음.
UniswapV2Factory 실패는 Pair 바이트코드 또는 CREATE2 관련 문제로 범위 좁혀짐.

---

## 테스트 2 — CREATE2 + EIP-1167 clone createPair()
**날짜:** 2026-04-10
**결론:** ✅ 완전 성공

### 배포 결과

| 컨트랙트 | 주소 | gasUsed | status |
|---|---|---|---|
| MockERC20 (TokenA, TKA) | `0xc01571e2c35C04eD99C92Ca692f00613e90FAcEC` | 790,071 | ✓ |
| MockERC20 (TokenB, TKB) | `0x10116774276cbf0CF26a84934a0B3B9F143e1A62` | 790,071 | ✓ |
| FactoryWithPair | `0xE3092F25c603097385447bF4E11fCcfeDB9f3F4a` | 666,709 | ✓ |

### createPair() 결과

| 항목 | 값 |
|---|---|
| tx hash | `0x7ba2fdbd7301a4c853db98da6c482b137061e190d0208d89fbe61cc52c59ec76` |
| status | 1 (success) |
| gasUsed | 157,602 |
| estimateGas | 158,810 |
| 생성된 pair | `0x5bc2380306bB2A476EA676b00c35a996Bf01a414` |
| pairImplementation | `0xf57283a136463f6c27daa5e55215a1102e355d75` |

### PairCreated 이벤트

```
token0: 0x10116774276cbf0CF26a84934a0B3B9F143e1A62  (TokenB — sort 결과)
token1: 0xc01571e2c35C04eD99C92Ca692f00613e90FAcEC  (TokenA)
pair:   0x5bc2380306bB2A476EA676b00c35a996Bf01a414
length: 1
```

### 상태 검증

```
allPairs.length: 1
getPair[A][B]:   0x5bc2380306bB2A476EA676b00c35a996Bf01a414
getPair[B][A]:   0x5bc2380306bB2A476EA676b00c35a996Bf01a414  (양방향 매핑 정상)
```

---

## 결론

| 기능 | 지원 여부 |
|---|---|
| Solidity 0.5.16 컨트랙트 배포 | ✅ |
| CREATE2 opcode | ✅ |
| EIP-1167 minimal proxy 바이트코드 조립 (`abi.encodePacked`) | ✅ |
| EIP-1167 clone 배포 (via CREATE2) | ✅ |
| `getPair` mapping 양방향 저장 | ✅ |
| PairCreated 이벤트 발행 | ✅ |

**핵심 발견:** StableNet은 CREATE2와 EIP-1167 clone 패턴을 완전히 지원한다.
원래 UniswapV2Factory 실패 원인은 **Pair 전체 바이트코드를 Factory 바이트코드 내에 하드코딩(리터럴 임베딩)**하는 방식 — 즉 `type(UniswapV2Pair).creationCode` 를 `assembly { create2(...) }` 에 인라인으로 넘기는 구조에 있었을 가능성이 높음.

---

## 권장 아키텍처 (Phase 2-B DEX 시나리오)

UniswapV2Factory 원본 대신 **EIP-1167 clone factory** 패턴 사용:

```
[이미 배포된 Pair 구현체]  0xf57283a136463f6c27daa5e55215a1102e355d75
         ↓
[FactoryWithPair]  CREATE2 + EIP-1167 clone → Pair 주소 결정론적 생성
         ↓
[addLiquidity / swap]  LiquidityPool 컨트랙트 or Pair에 직접 호출
```

**장점:**
- Factory 바이트코드에 Pair 바이트코드를 임베딩하지 않아 사이즈 문제 없음
- CREATE2 salt = `keccak256(token0, token1)` → 페어 주소 오프체인 계산 가능
- StableNet 검증 완료

---

## 파일 목록

| 파일 | 설명 |
|---|---|
| `contracts/templates/SimpleFactory.sol` | createPair 없는 최소 Factory (테스트 1) |
| `contracts/templates/MockERC20.sol` | 테스트용 ERC20 (1M supply, 18 decimals) |
| `contracts/templates/FactoryWithPair.sol` | CREATE2 + EIP-1167 clone createPair() (테스트 2) |
| `scripts/test-factory-deploy.ts` | SimpleFactory 배포 스크립트 |
| `scripts/test-create-pair.ts` | 전체 createPair() 시나리오 스크립트 |
