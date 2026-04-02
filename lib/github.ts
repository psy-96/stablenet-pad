interface GitHubPushResult {
  commitUrl: string | null
  error: string | null
}

const GITHUB_API = 'https://api.github.com'

/**
 * GitHub Contents API로 JSON 파일을 push한다.
 * 파일이 이미 존재하면 sha를 가져와 업데이트(덮어쓰기)한다.
 */
export async function pushDeploymentArtifact(
  contractName: string,
  content: object,
  isRedeploy: boolean
): Promise<GitHubPushResult> {
  const token = process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO

  if (!token || !owner || !repo) {
    return { commitUrl: null, error: 'GitHub 환경변수가 설정되지 않았습니다' }
  }

  const filePath = `deployments/stablenet-testnet/${contractName}.json`
  const apiUrl = `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  // 기존 파일 sha 조회 (재배포 시 필요)
  let sha: string | undefined
  try {
    const getRes = await fetch(apiUrl, { headers })
    if (getRes.ok) {
      const existing = (await getRes.json()) as { sha: string }
      sha = existing.sha
    }
  } catch {
    // 파일이 없으면 sha 없이 진행
  }

  const commitMessage = isRedeploy
    ? `redeploy: ${contractName} to stablenet-testnet`
    : `deploy: ${contractName} to stablenet-testnet`

  const body: Record<string, string> = {
    message: commitMessage,
    content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
  }
  if (sha) body.sha = sha

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })

  if (!putRes.ok) {
    const errText = await putRes.text()
    return { commitUrl: null, error: `GitHub push 실패 (${putRes.status}): ${errText.slice(0, 200)}` }
  }

  const putData = (await putRes.json()) as { commit: { html_url: string } }
  return { commitUrl: putData.commit.html_url, error: null }
}
