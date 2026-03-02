import { shell } from 'electron'
import { setSecret, getSecret, deleteSecret } from '../keychain'

const GITHUB_CLIENT_ID = 'Ov23li4eFqp3k5PxS0hE' // Public OAuth app client ID
const POLL_INTERVAL_MS = 5000

interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

interface AccessTokenResponse {
  access_token?: string
  error?: string
}

export async function startGitHubDeviceFlow(): Promise<{ userCode: string; verificationUri: string }> {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, scope: 'repo' }),
  })
  const data: DeviceCodeResponse = await res.json()
  return { userCode: data.user_code, verificationUri: data.verification_uri }
}

export async function pollForGitHubToken(deviceCode: string, timeoutMs = 120_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    })
    const data: AccessTokenResponse = await res.json()
    if (data.access_token) {
      await storeGitHubToken(data.access_token)
      return data.access_token
    }
    if (data.error === 'access_denied') throw new Error('GitHub authorization denied')
  }
  throw new Error('GitHub authorization timed out')
}

export async function storeGitHubToken(token: string): Promise<void> {
  await setSecret('app', 'github-token', token)
}

export async function getStoredGitHubToken(): Promise<string | null> {
  return getSecret('app', 'github-token')
}

export async function deleteGitHubToken(): Promise<void> {
  await deleteSecret('app', 'github-token')
}
