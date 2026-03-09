const AGENT_HEX_COLORS = [
  'fb923c', '60a5fa', '34d399', 'a78bfa', 'fb7185',
  'fbbf24', '22d3ee', 'e879f9', 'a3e635', '818cf8',
  '2dd4bf', 'f472b6', '38bdf8', 'facc15', 'c084fc',
  'f87171', '4ade80', '94a3b8', 'a8a29e', 'a1a1aa',
] as const

export function agentHexColor(index: number): string {
  return AGENT_HEX_COLORS[index % AGENT_HEX_COLORS.length]
}
