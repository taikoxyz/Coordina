// Claude model provider using Anthropic API with Claude model family branding
// FEATURE: Claude provider for direct access to Claude models via Anthropic API
import { registerProvider, fetchWithTimeout, type ModelProvider } from './base'

const SUPPORTED_MODELS = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']

const claude: ModelProvider = {
  id: 'claude',
  displayName: 'Claude',
  defaultModel: 'claude-sonnet-4-6',
  authType: 'oauth',
  oauthConfig: {
    authUrl: 'PLACEHOLDER_ANTHROPIC_AUTH_URL',
    tokenUrl: 'PLACEHOLDER_ANTHROPIC_TOKEN_URL',
    scopes: ['models:read', 'completions:write'],
    clientId: 'PLACEHOLDER_ANTHROPIC_CLIENT_ID',
    clientSecret: 'PLACEHOLDER_ANTHROPIC_CLIENT_SECRET',
  },
  configSchema: {
    type: 'object',
    required: ['model'],
    properties: {
      model: { type: 'string', title: 'Model', enum: SUPPORTED_MODELS, default: 'claude-sonnet-4-6' },
    },
  },
  supportedModels: [
    { id: 'claude-opus-4-6', displayName: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5' },
  ],
  validate() {
    return { valid: true }
  },
  async testConnection(config) {
    try { await claude.listModels(config); return { valid: true } }
    catch (e) { return { valid: false, errors: [(e as Error).message] } }
  },
  async listModels(config) {
    const c = config as { apiKey?: string }
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
      headers: { Authorization: `Bearer ${c.apiKey ?? ''}`, 'anthropic-version': '2023-06-01' },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(body.error?.message ?? `HTTP ${res.status}`)
    }
    const body = await res.json() as { data?: { id: string }[] }
    return body.data?.map(m => m.id).filter(id => id.startsWith('claude')).sort() ?? SUPPORTED_MODELS
  },
  toOpenClawJson(config) {
    const c = config as { model: string }
    return { agents: { defaults: { model: { primary: `anthropic/${c.model}` } } }, models: { providers: { anthropic: {} } } }
  },
  toEnvVars(config) {
    const c = config as { apiKey: string }
    return { ANTHROPIC_API_KEY: c.apiKey }
  },
}

registerProvider(claude)
