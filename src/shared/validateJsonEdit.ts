import type { TeamSpec } from './types'

export function validateJsonEdit(
  oldSpec: TeamSpec,
  newSpec: TeamSpec
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (newSpec.slug !== oldSpec.slug) {
    errors.push(`Team slug cannot be changed (was "${oldSpec.slug}", got "${newSpec.slug}")`)
  }

  if (newSpec.deployedEnvSlug !== oldSpec.deployedEnvSlug) {
    errors.push(`deployedEnvSlug cannot be changed`)
  }

  const oldSlugs = new Set(oldSpec.agents.map((a) => a.slug))
  const newAgentsBySlug = new Map(newSpec.agents.map((a) => [a.slug, a]))

  for (const oldAgent of oldSpec.agents) {
    if (!newAgentsBySlug.has(oldAgent.slug)) {
      errors.push(`Agent slug "${oldAgent.slug}" cannot be removed or renamed`)
    }
  }

  return { valid: errors.length === 0, errors }
}
