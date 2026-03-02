export interface ValidationResult {
  valid: boolean
  errors?: string[]
}

export interface OpenClawModelConfig {
  provider: string
  model: string
  apiKey?: string
  baseUrl?: string
  [key: string]: unknown
}

export interface ModelProvider {
  id: string
  displayName: string
  configSchema: object
  supportedModels: { id: string; displayName: string }[]
  validate(config: unknown): ValidationResult
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
