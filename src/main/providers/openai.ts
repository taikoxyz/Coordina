import { registerProvider, fetchWithTimeout, type ModelProvider } from './base'

const openai: ModelProvider = {
  id: 'openai',
  displayName: 'OpenAI',
  defaultModel: 'gpt-4o',
  configSchema: {
    type: 'object',
    required: ['apiKey', 'model'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', description: 'Your OpenAI API key (sk-...)', format: 'password' },
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
  validate(config) {
    const c = config as { apiKey?: string; model?: string }
    if (!c.apiKey?.startsWith('sk-')) return { valid: false, errors: ['API key must start with sk-'] }
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
    const c = config as { apiKey: string; model: string }
    return { agents: { defaults: { model: { primary: `openai/${c.model}` } } }, models: { providers: { openai: { apiKey: c.apiKey, baseUrl: 'https://api.openai.com/v1', api: 'openai-completions', models: [{ id: c.model, name: c.model }] } } } }
  },
}

registerProvider(openai)
