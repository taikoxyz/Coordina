import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

import { registerAgentsWithMissionControl } from '../ipc/missionControl'

describe('registerAgentsWithMissionControl', () => {
  it('calls /api/gateways for each non-lead agent', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1, name: 'alice' }) })
    global.fetch = mockFetch

    await registerAgentsWithMissionControl({
      mcUrl: 'https://mc.example.com',
      apiKey: 'key',
      namespace: 'alpha',
      agents: [
        { slug: 'alice', isLead: true },
        { slug: 'bob', isLead: false },
      ],
    })

    const calls = (mockFetch.mock.calls as unknown[][]).map(c => c[0] as string)
    expect(calls.some(u => u.includes('/api/gateways'))).toBe(true)
    expect(calls.filter(u => u.includes('/api/agents')).length).toBe(2)
  })

  it('only calls /api/agents when all agents are lead', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) })
    global.fetch = mockFetch

    await registerAgentsWithMissionControl({
      mcUrl: 'https://mc.example.com',
      apiKey: 'key',
      namespace: 'alpha',
      agents: [{ slug: 'alice', isLead: true }],
    })

    const calls = (mockFetch.mock.calls as unknown[][]).map(c => c[0] as string)
    expect(calls.some(u => u.includes('/api/gateways'))).toBe(false)
    expect(calls.filter(u => u.includes('/api/agents')).length).toBe(1)
  })
})
