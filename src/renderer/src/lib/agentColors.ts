const AGENT_COLORS = [
  { bg: 'bg-orange-50 text-orange-600', text: 'text-orange-600', hex: 'fb923c' },
  { bg: 'bg-blue-50 text-blue-600', text: 'text-blue-600', hex: '60a5fa' },
  { bg: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-600', hex: '34d399' },
  { bg: 'bg-violet-50 text-violet-600', text: 'text-violet-600', hex: 'a78bfa' },
  { bg: 'bg-rose-50 text-rose-600', text: 'text-rose-600', hex: 'fb7185' },
  { bg: 'bg-amber-50 text-amber-600', text: 'text-amber-600', hex: 'fbbf24' },
  { bg: 'bg-cyan-50 text-cyan-600', text: 'text-cyan-600', hex: '22d3ee' },
  { bg: 'bg-fuchsia-50 text-fuchsia-600', text: 'text-fuchsia-600', hex: 'e879f9' },
  { bg: 'bg-lime-50 text-lime-600', text: 'text-lime-600', hex: 'a3e635' },
  { bg: 'bg-indigo-50 text-indigo-600', text: 'text-indigo-600', hex: '818cf8' },
  { bg: 'bg-teal-50 text-teal-600', text: 'text-teal-600', hex: '2dd4bf' },
  { bg: 'bg-pink-50 text-pink-600', text: 'text-pink-600', hex: 'f472b6' },
  { bg: 'bg-sky-50 text-sky-600', text: 'text-sky-600', hex: '38bdf8' },
  { bg: 'bg-yellow-50 text-yellow-600', text: 'text-yellow-600', hex: 'facc15' },
  { bg: 'bg-purple-50 text-purple-600', text: 'text-purple-600', hex: 'c084fc' },
  { bg: 'bg-red-50 text-red-600', text: 'text-red-600', hex: 'f87171' },
  { bg: 'bg-green-50 text-green-600', text: 'text-green-600', hex: '4ade80' },
  { bg: 'bg-slate-50 text-slate-600', text: 'text-slate-600', hex: '94a3b8' },
  { bg: 'bg-stone-50 text-stone-600', text: 'text-stone-600', hex: 'a8a29e' },
  { bg: 'bg-zinc-50 text-zinc-600', text: 'text-zinc-600', hex: 'a1a1aa' },
] as const

export function agentColor(index: number): string {
  return AGENT_COLORS[index % AGENT_COLORS.length].bg
}

export function agentTextColor(index: number): string {
  return AGENT_COLORS[index % AGENT_COLORS.length].text
}

export function agentHexColor(index: number): string {
  return AGENT_COLORS[index % AGENT_COLORS.length].hex
}
