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
  const contractsDir = path.join(projectRoot, 'contracts')

  // contracts/ 디렉토리에 .sol 복사 (Hardhat이 인식하는 위치)
  await fs.promises.mkdir(contractsDir, { recursive: true })
  const destPath = path.join(contractsDir, `${contractName}.sol`)
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

    // 컴파일 결과물 읽기
    const artifactPath = path.join(
      projectRoot,
      'artifacts',
      'contracts',
      `${contractName}.sol`,
      `${contractName}.json`
    )

    const artifactRaw = await fs.promises.readFile(artifactPath, 'utf-8')
    const artifact = JSON.parse(artifactRaw) as { abi: object[]; bytecode: string }

    return {
      contractName,
      abi: artifact.abi,
      bytecode: artifact.bytecode,
    }
  } finally {
    // contracts/ 임시 파일 정리 (artifacts/ 는 캐시로 유지)
    await fs.promises.rm(destPath, { force: true })
  }
}

function extractHardhatError(stderr: string): string {
  const errorMatch = stderr.match(/^Error:.*$/m)
  if (errorMatch) return errorMatch[0]
  return stderr.slice(-200)
}
