// GKE OAuth2 authentication via Electron BrowserWindow replacing gcloud CLI
// FEATURE: GCP OAuth2 auth flow storing tokens in OS keychain for GKE access
import { BrowserWindow } from 'electron'
import * as http from 'http'
import * as net from 'net'
import { OAuth2Client } from 'google-auth-library'
import { getEnvToken, setEnvToken } from '../../store/environments'

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/cloud-platform',
]

export interface GkeAuthConfig {
  clientId: string
  clientSecret: string
}

export const getOAuth2Client = async (envSlug: string, authConfig: GkeAuthConfig): Promise<OAuth2Client> => {
  const tokenJson = await getEnvToken(envSlug)
  if (tokenJson) {
    const client = new OAuth2Client(authConfig.clientId, authConfig.clientSecret)
    client.setCredentials(JSON.parse(tokenJson))
    return client
  }
  throw new Error('Not authenticated. Call authenticateGke first.')
}

export const authenticateGke = (envSlug: string, authConfig: GkeAuthConfig): Promise<void> =>
  new Promise((resolve, reject) => {
    let handled = false
    let win: BrowserWindow | null = null

    const server = http.createServer(async (req, res) => {
      if (handled) return
      handled = true

      const port = (server.address() as net.AddressInfo).port
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body><p>Authentication complete. You may close this window.</p></body></html>')
      server.close()
      win?.close()

      if (error || !code) {
        reject(new Error(error ?? 'No authorization code received'))
        return
      }
      try {
        const redirectUri = `http://127.0.0.1:${port}`
        const client = new OAuth2Client(authConfig.clientId, authConfig.clientSecret, redirectUri)
        const { tokens } = await client.getToken({ code, redirect_uri: redirectUri })
        await setEnvToken(envSlug, JSON.stringify(tokens))
        resolve()
      } catch (err) {
        reject(err)
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port
      const redirectUri = `http://127.0.0.1:${port}`
      const client = new OAuth2Client(authConfig.clientId, authConfig.clientSecret, redirectUri)
      const authUrl = client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, redirect_uri: redirectUri })

      win = new BrowserWindow({
        width: 600,
        height: 700,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      })
      win.loadURL(authUrl)
      win.on('closed', () => {
        server.close()
        if (!handled) reject(new Error('Authentication cancelled'))
      })
    })

    server.on('error', reject)
  })
