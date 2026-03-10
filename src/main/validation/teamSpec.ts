// Pure validation of team spec structure with model-level checks
// FEATURE: Team spec validation module with zero side effects on output
import { TeamSpec, ValidationResult, ValidationError } from '../../shared/types'

export const validateTeamSpec = (
  spec: TeamSpec
): ValidationResult => {
  const errors: ValidationError[] = []

  if (!spec.name?.trim()) errors.push({ field: 'name', message: 'Team name is required' })
  if (!spec.slug?.trim()) errors.push({ field: 'slug', message: 'Team slug is required' })
  if (!spec.agents?.length) errors.push({ field: 'agents', message: 'At least one agent is required' })

  for (const agent of spec.agents ?? []) {
    const prefix = `agents.${agent.slug}`

    if (!agent.slug?.trim()) errors.push({ field: prefix, message: 'Agent slug is required' })
    if (!agent.name?.trim()) errors.push({ field: `${prefix}.name`, message: 'Agent name is required' })

    if (!agent.models || agent.models.length === 0) {
      errors.push({ field: `${prefix}.models`, message: 'At least one model is required' })
    }
  }

  return { valid: errors.length === 0, errors }
}
