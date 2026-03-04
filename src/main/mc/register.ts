// Registers agents with Mission Control via its public REST API
// FEATURE: MC agent registration for external Electron coordinator

export interface McRegistrationInput {
  mcBaseUrl: string
  apiKey: string
  teamSlug: string
  agents: Array<{ slug: string; name: string; role: string; isLead: boolean }>
  namespace: string
}

export interface McRegistrationResult {
  ok: boolean
  registered: string[]
  errors: Array<{ slug: string; error: string }>
}

export async function registerAgentsWithMc(input: McRegistrationInput): Promise<McRegistrationResult> {
  const { mcBaseUrl, apiKey, agents, namespace } = input
  const headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey }
  const registered: string[] = []
  const errors: Array<{ slug: string; error: string }> = []

  for (const agent of agents) {
    const host = `agent-${agent.slug}.${namespace}.svc.cluster.local`

    try {
      const gwRes = await fetch(`${mcBaseUrl}/api/gateways`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: agent.name, host, port: 18789 }),
      })
      if (!gwRes.ok) {
        const text = await gwRes.text()
        errors.push({ slug: agent.slug, error: `gateway ${gwRes.status}: ${text}` })
        continue
      }

      const agentRes = await fetch(`${mcBaseUrl}/api/agents`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: agent.name, slug: agent.slug, role: agent.role, host, port: 18789, isLead: agent.isLead }),
      })
      if (!agentRes.ok) {
        const text = await agentRes.text()
        errors.push({ slug: agent.slug, error: `agent ${agentRes.status}: ${text}` })
        continue
      }

      registered.push(agent.slug)
    } catch (err) {
      errors.push({ slug: agent.slug, error: String(err) })
    }
  }

  return { ok: errors.length === 0, registered, errors }
}
