'use client'

import { useState, useCallback } from 'react'
import {
  useAccount,
  useSendTransaction,
} from 'wagmi'
import { encodeDeployData, encodeFunctionData, type Abi, type AbiFunction, type Hash } from 'viem'
import { erc1967ProxyAbi, erc1967ProxyBytecode } from '@/lib/erc1967proxy'
import type {
  ContractType,
  ContractParams,
  ERC20Params,
  LiquidityPoolParams,
  ConfirmRequest,
} from '@/types'

export type LogEntry = {
  id: number
  message: string
  type: 'info' | 'success' | 'error'
}

interface UseDeployResult {
  logs: LogEntry[]
  isDeploying: boolean
  deploy: (params: {
    file: File | null
    contractType: ContractType
    params: ContractParams
    useProxy: boolean
  }) => Promise<void>
  clearLogs: () => void
  githubCommitUrl: string | null
  deployedProxyAddress: string | null
  deployedImplAddress: string | null
  deployedAbi: object[] | null
  downloadArtifact: (() => void) | null
}

let logCounter = 0

export function useDeploy(): UseDeployResult {
  const { address } = useAccount()
  const { sendTransactionAsync } = useSendTransaction()

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isDeploying, setIsDeploying] = useState(false)
  const [githubCommitUrl, setGithubCommitUrl] = useState<string | null>(null)
  const [deployedProxyAddress, setDeployedProxyAddress] = useState<string | null>(null)
  const [deployedImplAddress, setDeployedImplAddress] = useState<string | null>(null)
  const [deployedAbi, setDeployedAbi] = useState<object[] | null>(null)
  const [artifactData, setArtifactData] = useState<object | null>(null)

  function addLog(message: string, type: LogEntry['type'] = 'info') {
    setLogs((prev) => [...prev, { id: ++logCounter, message, type }])
  }

  const clearLogs = useCallback(() => {
    setLogs([])
    setGithubCommitUrl(null)
    setDeployedProxyAddress(null)
    setDeployedImplAddress(null)
    setDeployedAbi(null)
    setArtifactData(null)
  }, [])

  const deploy = useCallback(
    async ({
      file,
      contractType,
      params,
      useProxy,
    }: {
      file: File | null
      contractType: ContractType
      params: ContractParams
      useProxy: boolean
    }) => {
      if (!address) return

      setIsDeploying(true)
      clearLogs()

      try {
        // ── Phase 1: 서버 컴파일 ──────────────────────────────────────────
        let tempPath: string
        let deploymentId: string
        let fileName: string

        if (contractType === 'LiquidityPool') {
          addLog('LiquidityPool 템플릿 로드 중...')
          const templateRes = await fetch('/api/template?type=LiquidityPool')
          if (!templateRes.ok) {
            const err = (await templateRes.json()) as { error: string }
            throw new Error(err.error)
          }
          const templateData = (await templateRes.json()) as {
            tempPath: string
            deploymentId: string
          }
          tempPath = templateData.tempPath
          deploymentId = templateData.deploymentId
          fileName = 'LiquidityPool.sol'
        } else {
          if (!file) throw new Error('파일이 필요합니다')
          addLog('서버에 파일 업로드 중...')
          const formData = new FormData()
          formData.append('file', file)
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
          if (!uploadRes.ok) {
            const err = (await uploadRes.json()) as { error: string }
            throw new Error(err.error)
          }
          const uploadData = (await uploadRes.json()) as {
            tempPath: string
            deploymentId: string
          }
          tempPath = uploadData.tempPath
          deploymentId = uploadData.deploymentId
          fileName = file.name
        }

        addLog('Hardhat 컴파일 요청 중...')

        const deployRes = await fetch('/api/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractType,
            fileName,
            tempPath,
            deploymentId,
            params,
            useProxy,
            deployerAddress: address,
          }),
        })

        if (!deployRes.ok) {
          const err = (await deployRes.json()) as { error: string }
          throw new Error(`컴파일 실패: ${err.error}`)
        }

        const compiled = (await deployRes.json()) as {
          abi: object[]
          bytecode: string
          deploymentId: string
        }

        const abi = compiled.abi as Abi
        const bytecode = compiled.bytecode as `0x${string}`

        addLog('컴파일 완료', 'success')

        // ── Phase 2: 브라우저 서명 + 전송 ────────────────────────────────
        addLog('MetaMask 서명 요청 중...')

        // 컨스트럭터 args 인코딩
        const constructorArgs = buildConstructorArgs(contractType, params)

        let finalTxHash: Hash
        let implAddress: string | null = null

        if (useProxy) {
          // ── 2-tx Proxy 배포 ───────────────────────────────────────────
          // Tx 1: Implementation 배포
          const implData = encodeDeployData({
            abi,
            bytecode,
            args: [], // OZ Upgradeable: constructor 비어 있음
          })

          addLog('Implementation 배포 트랜잭션 전송 중...')
          const implHash = await sendTransactionAsync({ data: implData })
          addLog(`Implementation 트랜잭션 제출: ${implHash.slice(0, 16)}...`)

          // 서버에서 receipt 대기 (CORS 우회)
          addLog('Implementation receipt 대기 중...')
          const implWait = await fetch('/api/tx/wait', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ txHash: implHash }),
          })
          if (!implWait.ok) {
            const e = (await implWait.json()) as { error: string }
            throw new Error(`Implementation receipt 실패: ${e.error}`)
          }
          const implResult = (await implWait.json()) as {
            contractAddress: string | null
          }
          if (!implResult.contractAddress) {
            throw new Error('Implementation 배포 실패 — 컨트랙트 주소를 받지 못했습니다')
          }

          implAddress = implResult.contractAddress
          addLog(`Implementation 배포 완료: ${implAddress}`, 'success')

          // initData: initialize() 호출 인코딩
          const initData = encodeInitData(abi, contractType, params)

          // Tx 2: Proxy 배포
          const proxyData = encodeDeployData({
            abi: erc1967ProxyAbi,
            bytecode: erc1967ProxyBytecode,
            args: [implAddress, initData],
          })

          addLog('Proxy 배포 트랜잭션 전송 중...')
          finalTxHash = await sendTransactionAsync({ data: proxyData })
          addLog(`Proxy 트랜잭션 제출: ${finalTxHash.slice(0, 16)}...`)
        } else {
          // ── 1-tx 단순 배포 ──────────────────────────────────────────
          const data = encodeDeployData({ abi, bytecode, args: constructorArgs })

          addLog('배포 트랜잭션 전송 중...')
          finalTxHash = await sendTransactionAsync({ data })
          addLog(`트랜잭션 제출: ${finalTxHash.slice(0, 16)}...`)
        }

        setDeployedImplAddress(implAddress)
        setDeployedAbi(abi as object[])

        // ── Phase 3: 서버 저장 ────────────────────────────────────────
        addLog('결과물 저장 중...')

        const contractName =
          contractType === 'LiquidityPool' ? 'LiquidityPool' : file!.name.replace(/\.sol$/, '')
        const confirmBody: ConfirmRequest = {
          deploymentId,
          contractName,
          contractType,
          txHash: finalTxHash,
          implAddress,
          deployerAddress: address,
          abi: abi as object[],
        }

        const confirmRes = await fetch('/api/deploy/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(confirmBody),
        })

        if (!confirmRes.ok) {
          const e = (await confirmRes.json()) as { error: string }
          throw new Error(`저장 실패: ${e.error}`)
        }

        const confirmData = (await confirmRes.json()) as import('@/types').ConfirmResponse

        setDeployedProxyAddress(confirmData.proxyAddress)

        if (confirmData.githubCommitUrl) {
          setGithubCommitUrl(confirmData.githubCommitUrl)
          addLog(`GitHub push 완료: ${confirmData.githubCommitUrl}`, 'success')
        } else {
          addLog('GitHub push 실패 — JSON 다운로드로 공유하세요', 'error')
        }

        // 다운로드용 아티팩트 저장
        setArtifactData({
          contractName,
          type: contractType,
          network: 'stablenet-testnet',
          chainId: 8283,
          proxyAddress: confirmData.proxyAddress,
          implementationAddress: implAddress ?? null,
          abi,
          txHash: finalTxHash,
          blockNumber: confirmData.blockNumber,
          deployedAt: new Date().toISOString(),
          deployer: address,
        })

        addLog('배포 완료 ✓', 'success')
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류'
        addLog(msg, 'error')
      } finally {
        setIsDeploying(false)
      }
    },
    [address, sendTransactionAsync, clearLogs]
  )

  const downloadArtifact = artifactData
    ? () => {
        const blob = new Blob([JSON.stringify(artifactData, null, 2)], {
          type: 'application/json',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'deployment.json'
        a.click()
        URL.revokeObjectURL(url)
      }
    : null

  return {
    logs,
    isDeploying,
    deploy,
    clearLogs,
    githubCommitUrl,
    deployedProxyAddress,
    deployedImplAddress,
    deployedAbi,
    downloadArtifact,
  }
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildConstructorArgs(contractType: ContractType, _params: ContractParams): unknown[] {
  if (contractType === 'ERC20') {
    // OZ ERC20Upgradeable: constructor()는 비어 있음. initialize()는 Proxy initData에서 처리.
    return []
  }
  // LiquidityPool: 마찬가지로 initialize 패턴이면 []
  return []
}

function encodeInitData(abi: Abi, contractType: ContractType, params: ContractParams): `0x${string}` {
  const initFn = abi.find(
    (item): item is AbiFunction => item.type === 'function' && item.name === 'initialize'
  )

  if (!initFn) {
    throw new Error(
      'initialize() 함수를 찾을 수 없습니다. OpenZeppelin Upgradeable 컨트랙트인지 확인하세요.'
    )
  }

  if (contractType === 'ERC20') {
    const p = params as ERC20Params
    const expectedInputs = 3 // name, symbol, initialSupply
    if (initFn.inputs.length < expectedInputs) {
      throw new Error(
        `ERC20 initialize() 파라미터 수 불일치: 예상 ${expectedInputs}개, 실제 ${initFn.inputs.length}개`
      )
    }
    return encodeFunctionData({
      abi,
      functionName: 'initialize',
      args: [p.name, p.symbol, BigInt(p.initialSupply)],
    })
  }

  // LiquidityPool
  const p = params as LiquidityPoolParams
  return encodeFunctionData({
    abi,
    functionName: 'initialize',
    args: [p.tokenA, p.tokenB, BigInt(p.fee)],
  })
}
