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
  models: { providers: { [provider: string]: { apiKey?: string; baseUrl?: string; api?: string } } }
}

export function openrouterToOpenClawJson(model: string): OpenClawModelConfig {
  return {
    agents: { defaults: { model: { primary: `openrouter/${model}` } } },
    models: { providers: { openrouter: { baseUrl: 'https://openrouter.ai/api/v1', api: 'openai-completions' } } },
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
