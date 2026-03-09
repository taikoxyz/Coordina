// Generic OAuth2 authorization-code flow for AI model providers
// FEATURE: Provider OAuth authentication using BrowserWindow and ephemeral HTTP callback
import { BrowserWindow } from 'electron'
import * as http from 'http'
import * as net from 'net'
import { setProviderApiKey } from '../store/providers'

export interface OAuthConfig {
  authUrl: string
  tokenUrl: string
  scopes: string[]
  clientId: string
  clientSecret: string
}

export const authenticateProvider = (slug: string, config: OAuthConfig): Promise<string> => {
  if (config.authUrl.startsWith('PLACEHOLDER') || config.tokenUrl.startsWith('PLACEHOLDER') || config.clientId.startsWith('PLACEHOLDER')) {
    return Promise.reject(new Error('OAuth not configured yet — replace placeholder authUrl, tokenUrl, and clientId in the provider module'))
  }
  return new Promise((resolve, reject) => {
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
        const tokenRes = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: config.clientId,
            client_secret: config.clientSecret,
          }).toString(),
        })
        if (!tokenRes.ok) throw new Error(`Token exchange failed: HTTP ${tokenRes.status}`)
        const tokens = await tokenRes.json() as { access_token: string }
        await setProviderApiKey(slug, tokens.access_token)
        resolve(tokens.access_token)
      } catch (err) {
        reject(err)
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port
      const redirectUri = `http://127.0.0.1:${port}`
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: redirectUri,
        scope: config.scopes.join(' '),
      })

      win = new BrowserWindow({
        width: 600,
        height: 700,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      })
      win.loadURL(`${config.authUrl}?${params.toString()}`)
      win.on('closed', () => {
        server.close()
        if (!handled) reject(new Error('Authentication cancelled'))
      })
    })

    server.on('error', reject)
  })
}
