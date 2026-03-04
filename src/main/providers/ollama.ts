import { registerProvider, fetchWithTimeout, type ModelProvider } from './base'

const ollama: ModelProvider = {
  id: 'ollama',
  displayName: 'Ollama',
  defaultModel: 'llama3',
  configSchema: {
    type: 'object',
    required: ['baseUrl', 'model'],
    properties: {
      baseUrl: { type: 'string', title: 'Base URL', description: 'Ollama server URL (e.g. http://localhost:11434)', default: 'http://localhost:11434' },
      model: { type: 'string', title: 'Model', description: 'Model name (e.g. llama3, mistral, codellama)', default: 'llama3' },
    },
  },
  supportedModels: [
    { id: 'llama3', displayName: 'Llama 3' },
    { id: 'mistral', displayName: 'Mistral' },
    { id: 'codellama', displayName: 'Code Llama' },
    { id: 'phi3', displayName: 'Phi-3' },
  ],
  validate(config) {
    const c = config as { baseUrl?: string; model?: string }
    if (!c.baseUrl) return { valid: false, errors: ['Base URL is required'] }
    return { valid: true }
  },
  async testConnection(config) {
    try { await ollama.listModels(config); return { valid: true } }
    catch (e) { return { valid: false, errors: [(e as Error).message] } }
  },
  async listModels(config) {
    const c = config as { baseUrl?: string }
    const res = await fetchWithTimeout(`${c.baseUrl ?? 'http://localhost:11434'}/api/tags`)
    if (!res.ok) throw new Error(`HTTP ${res.status} — is Ollama running?`)
    const body = await res.json() as { models?: { name: string }[] }
    return body.models?.map(m => m.name).sort() ?? []
  },
  toOpenClawJson(config) {
    const c = config as { baseUrl: string; model: string }
    return { agents: { defaults: { model: { primary: `ollama/${c.model}` } } }, models: { providers: { ollama: { baseUrl: c.baseUrl ?? 'http://localhost:11434' } } } }
  },
}

registerProvider(ollama)
