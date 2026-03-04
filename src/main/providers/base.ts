export const fetchWithTimeout = async (url: string, options: RequestInit = {}, ms = 15000): Promise<Response> => {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

export interface ValidationResult {
  valid: boolean
  errors?: string[]
}

export interface OpenClawModelConfig {
  agents: { defaults: { model: { primary: string; fallbacks?: string[] } } }
  models: { providers: { [provider: string]: { apiKey?: string; baseUrl?: string; api?: string } } }
}

export interface ModelProvider {
  id: string
  displayName: string
  defaultModel: string
  configSchema: object
  supportedModels: { id: string; displayName: string }[]
  validate(config: unknown): ValidationResult
  testConnection(config: unknown): Promise<ValidationResult>
  listModels(config: unknown): Promise<string[]>
  toOpenClawJson(config: unknown): OpenClawModelConfig
}

const registry = new Map<string, ModelProvider>()

export function registerProvider(p: ModelProvider): void {
  registry.set(p.id, p)
}

export function getProvider(id: string): ModelProvider {
  const p = registry.get(id)
  if (!p) throw new Error(`Unknown model provider: ${id}`)
  return p
}

export function listProviders(): ModelProvider[] {
  return [...registry.values()]
}

/** Test helper — reset registry between tests */
export function _resetRegistry(): void {
  registry.clear()
}
