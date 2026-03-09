export const fetchWithTimeout = async (url: string, options: RequestInit = {}, ms = 15000): Promise<Response> => {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

export interface OpenClawModelConfig {
  agents: { defaults: { model: { primary: string; fallbacks?: string[] } } }
  models: { providers: { [provider: string]: { apiKey?: string; baseUrl?: string; api?: string; models?: { id: string }[] } } }
}

export function openrouterToOpenClawJson(models: string[]): OpenClawModelConfig {
  const primary = models[0] || 'anthropic/claude-sonnet-4-6'
  const fallbacks = models.slice(1)
  const allModels = models.length > 0 ? models : [primary]
  return {
    agents: { defaults: { model: { primary: `openrouter/${primary}`, ...(fallbacks.length > 0 && { fallbacks: fallbacks.map(m => `openrouter/${m}`) }) } } },
    models: { providers: { openrouter: { baseUrl: 'https://openrouter.ai/api/v1', api: 'openai-completions', models: allModels.map(id => ({ id })) } } },
  }
}

export function openrouterToEnvVars(apiKey: string): Record<string, string> {
  return { OPENROUTER_API_KEY: apiKey }
}

export async function testOpenRouterConnection(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetchWithTimeout('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
      return { valid: false, error: body.error?.message ?? `HTTP ${res.status}` }
    }
    return { valid: true }
  } catch (e) {
    return { valid: false, error: (e as Error).message }
  }
}
