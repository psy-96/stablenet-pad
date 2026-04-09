import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execAsync = promisify(exec)

export interface CompileResult {
  contractName: string
  abi: object[]
  bytecode: string
}

/**
 * 업로드된 .sol 파일을 Hardhat으로 컴파일하고 ABI + bytecode를 반환한다.
 * @param contractFilePath - 컴파일할 .sol 파일 절대 경로
 * @param contractName - 파일명 (확장자 제외)
 */
export async function compileContract(
  contractFilePath: string,
  contractName: string
): Promise<CompileResult> {
  const projectRoot = process.cwd()
  const contractsDir = path.join(projectRoot, 'contracts', 'templates')

  // _tmp_ 접두사로 기존 템플릿 파일과 충돌 방지
  // (예: LiquidityPool.sol 원본을 덮어쓰지 않기 위함)
  const tmpFileName = `_tmp_${contractName}.sol`
  const destPath = path.join(contractsDir, tmpFileName)
  await fs.promises.mkdir(contractsDir, { recursive: true })
  await fs.promises.copyFile(contractFilePath, destPath)

  try {
    const { stderr } = await execAsync('npx hardhat compile --force', {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024, // 10MB — OZ imports can produce large output
      timeout: 30_000,
    })

    if (stderr && stderr.includes('Error:')) {
      throw new Error(extractHardhatError(stderr))
    }

    // artifact 디렉토리에서 실제 JSON 파일명을 찾음
    // 1순위: 파일명과 일치하는 artifact (UniswapV2Factory.sol → UniswapV2Factory.json)
    // 2순위: 디렉토리 내 첫 번째 non-dbg JSON (단일 컨트랙트 파일 대응)
    const artifactDir = path.join(
      projectRoot,
      'artifacts',
      'contracts',
      'templates',
      tmpFileName,
    )
    const files = await fs.promises.readdir(artifactDir)
    const jsonFile = selectArtifactFile(files, contractName)
    if (!jsonFile) {
      throw new Error(`컴파일 결과물을 찾을 수 없습니다: ${contractName}`)
    }

    const artifactRaw = await fs.promises.readFile(path.join(artifactDir, jsonFile), 'utf-8')
    const artifact = JSON.parse(artifactRaw) as { abi: object[]; bytecode: string }

    return {
      contractName,
      abi: artifact.abi,
      bytecode: artifact.bytecode,
    }
  } finally {
    // 임시 복사본 정리 (_tmp_ 접두사 파일만 삭제, 원본 템플릿 보존)
    await fs.promises.rm(destPath, { force: true })
  }
}

/**
 * artifact 디렉토리 파일 목록에서 가장 적절한 JSON을 선택한다.
 * - 1순위: `${contractName}.json` (파일명 일치)
 * - 2순위: 첫 번째 non-dbg JSON (단일 컨트랙트 파일 대응)
 */
export function selectArtifactFile(files: string[], contractName: string): string | undefined {
  return (
    files.find((f) => f === `${contractName}.json`) ??
    files.find((f) => f.endsWith('.json') && !f.endsWith('.dbg.json'))
  )
}

function extractHardhatError(stderr: string): string {
  const errorMatch = stderr.match(/^Error:.*$/m)
  if (errorMatch) return errorMatch[0]
  return stderr.slice(-200)
}
