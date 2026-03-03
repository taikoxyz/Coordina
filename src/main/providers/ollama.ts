import { registerProvider, type ModelProvider } from './base'

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
  toOpenClawJson(config) {
    const c = config as { baseUrl: string; model: string }
    return { provider: 'ollama', model: c.model, baseUrl: c.baseUrl }
  },
}

registerProvider(ollama)
