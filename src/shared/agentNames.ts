import { deriveSlug } from './slug'

export type AgentNameTheme = 'sci-fi' | 'movies' | 'mythology'
export const DEFAULT_AGENT_NAME_THEME: AgentNameTheme = 'sci-fi'

export interface AgentIdentity {
  name: string
  slug: string
}

export interface ExistingAgentIdentity {
  name?: string
  slug?: string
}

export const SCI_FI_AGENT_NAMES = [
  'Ripley',
  'Deckard',
  'Leeloo',
  'Neo',
  'Trinity',
  'Spock',
  'Uhura',
  'Data',
  'TARS',
  'Motoko',
  'Kara Thrace',
  'River',
  'Aeryn',
  'Riker',
  'Seven',
  'Korben',
  'Kaylee',
  'Andromeda',
  'Garrus',
  'Jadzia'
] as const

export const MOVIE_AGENT_NAMES = [
  'Maverick',
  'Furiosa',
  'Aragorn',
  'Indiana',
  'Mulan',
  'Katniss',
  'Hermione',
  'Maximus',
  'Amelie',
  'Clarice',
  'Moana',
  'Elsa',
  'Bond',
  'Rocky',
  'Vito',
  'Wallace',
  'Chihiro',
  'Bourne',
  'Padme',
  'Arthur Fleck'
] as const

export const MYTHOLOGY_AGENT_NAMES = [
  'Athena',
  'Apollo',
  'Artemis',
  'Hermes',
  'Cassandra',
  'Achilles',
  'Odysseus',
  'Penelope',
  'Circe',
  'Perseus',
  'Ariadne',
  'Orpheus',
  'Icarus',
  'Selene',
  'Calypso',
  'Thor',
  'Loki',
  'Freya',
  'Odin',
  'Skadi',
] as const

const NAME_VARIANTS = ['Prime', 'Nova', 'Echo', 'Vector', 'Comet', 'Cipher', 'Atlas', 'Drift'] as const

const normalize = (value: string): string => value.trim().toLowerCase()

const namePoolForTheme = (theme: AgentNameTheme): readonly string[] => {
  if (theme === 'sci-fi') return SCI_FI_AGENT_NAMES
  if (theme === 'movies') return MOVIE_AGENT_NAMES
  return MYTHOLOGY_AGENT_NAMES
}

const chooseUniqueName = (pool: readonly string[], usedNames: Set<string>): string => {
  for (const baseName of pool) {
    if (!usedNames.has(normalize(baseName))) return baseName
  }

  for (const variant of NAME_VARIANTS) {
    for (const baseName of pool) {
      const candidate = `${baseName} ${variant}`
      if (!usedNames.has(normalize(candidate))) return candidate
    }
  }

  let counter = 2
  while (true) {
    for (const baseName of pool) {
      const candidate = `${baseName} ${counter}`
      if (!usedNames.has(normalize(candidate))) return candidate
    }
    counter += 1
  }
}

const chooseUniqueSlug = (slugBase: string, usedSlugs: Set<string>): string => {
  const base = slugBase || 'agent'
  if (!usedSlugs.has(base)) return base

  let counter = 2
  while (usedSlugs.has(`${base}-${counter}`)) counter += 1
  return `${base}-${counter}`
}

export function generateAutoAgentIdentities(
  existingAgents: ExistingAgentIdentity[],
  count: number,
  theme: AgentNameTheme
): AgentIdentity[] {
  if (count <= 0) return []

  const usedNames = new Set(existingAgents.map((agent) => normalize(agent.name ?? '')).filter(Boolean))
  const usedSlugs = new Set(existingAgents.map((agent) => normalize(agent.slug ?? '')).filter(Boolean))
  const pool = namePoolForTheme(theme)
  const generated: AgentIdentity[] = []

  for (let i = 0; i < count; i += 1) {
    const name = chooseUniqueName(pool, usedNames)
    usedNames.add(normalize(name))

    const slug = chooseUniqueSlug(deriveSlug(name), usedSlugs)
    usedSlugs.add(slug)

    generated.push({ name, slug })
  }

  return generated
}
