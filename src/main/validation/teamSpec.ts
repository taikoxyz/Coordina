// Pure validation of team spec structure against loaded provider records
// FEATURE: Team spec validation module with zero side effects on output
import { TeamSpec, ProviderRecord, ValidationResult, ValidationError } from '../../shared/types'
import { getProvider } from '../providers/base'

export const validateTeamSpec = (
  spec: TeamSpec,
  providers: ProviderRecord[]
): ValidationResult => {
  const errors: ValidationError[] = []
  const providersBySlug = new Map(providers.map((p) => [p.slug, p]))

  if (!spec.name?.trim()) errors.push({ field: 'name', message: 'Team name is required' })
  if (!spec.slug?.trim()) errors.push({ field: 'slug', message: 'Team slug is required' })
  if (!spec.agents?.length) errors.push({ field: 'agents', message: 'At least one agent is required' })

  for (const agent of spec.agents ?? []) {
    const prefix = `agents.${agent.slug}`

    if (!agent.slug?.trim()) errors.push({ field: prefix, message: 'Agent slug is required' })
    if (!agent.name?.trim()) errors.push({ field: `${prefix}.name`, message: 'Agent name is required' })
    if (!agent.role?.trim()) errors.push({ field: `${prefix}.role`, message: 'Agent role is required' })
    if (!agent.soul?.trim()) errors.push({ field: `${prefix}.soul`, message: 'Agent soul is required' })

    if (!agent.providerSlug?.trim()) {
      errors.push({ field: `${prefix}.providerSlug`, message: 'Provider slug is required' })
      continue
    }

    const record = providersBySlug.get(agent.providerSlug)
    if (!record) {
      errors.push({ field: `${prefix}.providerSlug`, message: `Provider "${agent.providerSlug}" not found` })
      continue
    }

    try {
      getProvider(record.type)
    } catch {
      errors.push({ field: `${prefix}.providerSlug`, message: `Unknown provider type "${record.type}"` })
    }
  }


  return { valid: errors.length === 0, errors }
}
