// MiniMax model provider integration for Text-01 and chat models
// FEATURE: MiniMax provider for OpenAI-compatible inference API
import { registerProvider, fetchWithTimeout, type ModelProvider } from './base'

const STATIC_MODELS = ['MiniMax-Text-01', 'MiniMax-01', 'abab6.5s-chat']

const minimax: ModelProvider = {
  id: 'minimax',
  displayName: 'MiniMax',
  defaultModel: 'MiniMax-Text-01',
  authType: 'oauth',
  oauthConfig: {
    authUrl: 'PLACEHOLDER_MINIMAX_AUTH_URL',
    tokenUrl: 'PLACEHOLDER_MINIMAX_TOKEN_URL',
    scopes: ['openid'],
    clientId: 'PLACEHOLDER_MINIMAX_CLIENT_ID',
    clientSecret: 'PLACEHOLDER_MINIMAX_CLIENT_SECRET',
  },
  configSchema: {
    type: 'object',
    required: ['model'],
    properties: {
      model: { type: 'string', title: 'Model', enum: STATIC_MODELS, default: 'MiniMax-Text-01' },
    },
  },
  supportedModels: [
    { id: 'MiniMax-Text-01', displayName: 'MiniMax Text 01' },
    { id: 'MiniMax-01', displayName: 'MiniMax 01' },
    { id: 'abab6.5s-chat', displayName: 'ABAB 6.5S Chat' },
  ],
  validate() {
    return { valid: true }
  },
  async testConnection(config) {
    try { await minimax.listModels(config); return { valid: true } }
    catch (e) { return { valid: false, errors: [(e as Error).message] } }
  },
  async listModels(config) {
    const c = config as { apiKey?: string }
    const res = await fetchWithTimeout('https://api.minimax.chat/v1/models', {
      headers: { Authorization: `Bearer ${c.apiKey ?? ''}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { base_resp?: { status_msg?: string }; error?: { message?: string } }
      throw new Error(body.base_resp?.status_msg ?? body.error?.message ?? `HTTP ${res.status}`)
    }
    const body = await res.json() as { data?: { id: string }[] }
    return body.data?.map(m => m.id).sort() ?? STATIC_MODELS
  },
  toOpenClawJson(config) {
    const c = config as { model: string }
    return { agents: { defaults: { model: { primary: `minimax/${c.model}` } } }, models: { providers: { minimax: { baseUrl: 'https://api.minimax.chat/v1', api: 'openai-completions', models: [{ id: c.model, name: c.model }] } } } }
  },
  toEnvVars(config) {
    const c = config as { apiKey: string }
    return { MINIMAX_API_KEY: c.apiKey }
  },
}

registerProvider(minimax)
