import { registerProvider, fetchWithTimeout, type ModelProvider } from './base'

const openai: ModelProvider = {
  id: 'openai',
  displayName: 'OpenAI',
  defaultModel: 'gpt-4o',
  authType: 'oauth',
  oauthConfig: {
    authUrl: 'PLACEHOLDER_OPENAI_AUTH_URL',
    tokenUrl: 'PLACEHOLDER_OPENAI_TOKEN_URL',
    scopes: ['openid', 'profile'],
    clientId: 'PLACEHOLDER_OPENAI_CLIENT_ID',
    clientSecret: 'PLACEHOLDER_OPENAI_CLIENT_SECRET',
  },
  configSchema: {
    type: 'object',
    required: ['model'],
    properties: {
      model: { type: 'string', title: 'Model', enum: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini'], default: 'gpt-4o' },
    },
  },
  supportedModels: [
    { id: 'gpt-4o', displayName: 'GPT-4o' },
    { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini' },
    { id: 'o1', displayName: 'o1' },
    { id: 'o1-mini', displayName: 'o1 Mini' },
    { id: 'o3-mini', displayName: 'o3 Mini' },
  ],
  validate() {
    return { valid: true }
  },
  async testConnection(config) {
    try { await openai.listModels(config); return { valid: true } }
    catch (e) { return { valid: false, errors: [(e as Error).message] } }
  },
  async listModels(config) {
    const c = config as { apiKey?: string }
    const res = await fetchWithTimeout('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${c.apiKey ?? ''}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(body.error?.message ?? `HTTP ${res.status}`)
    }
    const body = await res.json() as { data?: { id: string }[] }
    return (body.data?.map(m => m.id) ?? [])
      .filter(id => /^(gpt-4|gpt-3\.5|o1|o3)/.test(id))
      .sort()
  },
  toOpenClawJson(config) {
    const c = config as { model: string }
    return { agents: { defaults: { model: { primary: `openai/${c.model}` } } }, models: { providers: { openai: { baseUrl: 'https://api.openai.com/v1', api: 'openai-completions', models: [{ id: c.model, name: c.model }] } } } }
  },
  toEnvVars(config) {
    const c = config as { apiKey: string }
    return { OPENAI_API_KEY: c.apiKey }
  },
}

registerProvider(openai)
