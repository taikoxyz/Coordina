import { describe, it, expect } from 'vitest'
import { resolveGatewayMode } from './mode'

describe('resolveGatewayMode', () => {
  it('returns explicit ingress mode', () => {
    expect(resolveGatewayMode({ gatewayMode: 'ingress', domain: '' })).toBe('ingress')
  })

  it('returns explicit port-forward mode', () => {
    expect(resolveGatewayMode({ gatewayMode: 'port-forward', domain: 'example.com' })).toBe('port-forward')
  })

  it('infers ingress mode when domain exists', () => {
    expect(resolveGatewayMode({ domain: 'example.com' })).toBe('ingress')
  })

  it('infers port-forward mode when no domain exists', () => {
    expect(resolveGatewayMode({})).toBe('port-forward')
  })
})
