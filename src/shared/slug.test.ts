import { describe, it, expect } from 'vitest'
import { deriveSlug } from './slug'

describe('deriveSlug', () => {
  it('derives slug from name', () => {
    expect(deriveSlug('Alice Chen')).toBe('alice-chen')
    expect(deriveSlug('Engineering Alpha!')).toBe('engineering-alpha')
  })

  it('handles unicode and special chars', () => {
    expect(deriveSlug('José García')).toBe('jose-garcia')
  })

  it('collapses multiple spaces', () => {
    expect(deriveSlug('Alice   Chen')).toBe('alice-chen')
  })

  it('trims leading/trailing spaces', () => {
    expect(deriveSlug('  Alice  ')).toBe('alice')
  })

  it('handles already slug-like strings', () => {
    expect(deriveSlug('my-team')).toBe('my-team')
  })

  it('handles numbers', () => {
    expect(deriveSlug('Team 42')).toBe('team-42')
  })
})
