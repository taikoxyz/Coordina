import { registerProvider, fetchWithTimeout, type ModelProvider } from './base'

const openrouter: ModelProvider = {
  id: 'openrouter',
  displayName: 'OpenRouter',
  defaultModel: 'openai/gpt-4o',
  authType: 'oauth',
  oauthConfig: {
    authUrl: 'PLACEHOLDER_OPENROUTER_AUTH_URL',
    tokenUrl: 'PLACEHOLDER_OPENROUTER_TOKEN_URL',
    scopes: ['openid'],
    clientId: 'PLACEHOLDER_OPENROUTER_CLIENT_ID',
    clientSecret: 'PLACEHOLDER_OPENROUTER_CLIENT_SECRET',
  },
  configSchema: {
    type: 'object',
    required: ['model'],
    properties: {
      model: { type: 'string', title: 'Model', description: 'Model identifier (e.g. openai/gpt-4o, anthropic/claude-sonnet-4-6)', default: 'openai/gpt-4o' },
    },
  },
  supportedModels: [
    { id: 'openai/gpt-4o', displayName: 'GPT-4o (via OpenRouter)' },
    { id: 'anthropic/claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6 (via OpenRouter)' },
    { id: 'google/gemini-pro-1.5', displayName: 'Gemini Pro 1.5 (via OpenRouter)' },
    { id: 'meta-llama/llama-3.1-70b-instruct', displayName: 'Llama 3.1 70B (via OpenRouter)' },
  ],
  validate() {
    return { valid: true }
  },
  async testConnection(config) {
    try { await openrouter.listModels(config); return { valid: true } }
    catch (e) { return { valid: false, errors: [(e as Error).message] } }
  },
  async listModels(config) {
    const c = config as { apiKey?: string }
    const res = await fetchWithTimeout('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${c.apiKey ?? ''}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(body.error?.message ?? `HTTP ${res.status}`)
    }
    const body = await res.json() as { data?: { id: string; name?: string }[] }
    return body.data?.map(m => m.id).sort() ?? []
  },
  toOpenClawJson(config) {
    const c = config as { model: string }
    return { agents: { defaults: { model: { primary: `openrouter/${c.model}` } } }, models: { providers: { openrouter: { baseUrl: 'https://openrouter.ai/api/v1', api: 'openai-completions' } } } }
  },
  toEnvVars(config) {
    const c = config as { apiKey: string }
    return { OPENROUTER_API_KEY: c.apiKey }
  },
}

registerProvider(openrouter)
