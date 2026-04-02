// ERC1967Proxy ABI + bytecode — OpenZeppelin 패키지 아티팩트에서 직접 임포트
// 브라우저에서 Proxy 배포 트랜잭션을 인코딩할 때 사용
import artifact from '@openzeppelin/contracts/build/contracts/ERC1967Proxy.json'
import type { Abi } from 'viem'

export const erc1967ProxyAbi = artifact.abi as Abi
export const erc1967ProxyBytecode = artifact.bytecode as `0x${string}`
