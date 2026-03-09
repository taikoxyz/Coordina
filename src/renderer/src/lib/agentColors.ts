export { agentHexColor } from '../../../shared/agentColors'

const AGENT_COLORS = [
  { bg: 'bg-orange-50 text-orange-600', text: 'text-orange-600' },
  { bg: 'bg-blue-50 text-blue-600', text: 'text-blue-600' },
  { bg: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-600' },
  { bg: 'bg-violet-50 text-violet-600', text: 'text-violet-600' },
  { bg: 'bg-rose-50 text-rose-600', text: 'text-rose-600' },
  { bg: 'bg-amber-50 text-amber-600', text: 'text-amber-600' },
  { bg: 'bg-cyan-50 text-cyan-600', text: 'text-cyan-600' },
  { bg: 'bg-fuchsia-50 text-fuchsia-600', text: 'text-fuchsia-600' },
  { bg: 'bg-lime-50 text-lime-600', text: 'text-lime-600' },
  { bg: 'bg-indigo-50 text-indigo-600', text: 'text-indigo-600' },
  { bg: 'bg-teal-50 text-teal-600', text: 'text-teal-600' },
  { bg: 'bg-pink-50 text-pink-600', text: 'text-pink-600' },
  { bg: 'bg-sky-50 text-sky-600', text: 'text-sky-600' },
  { bg: 'bg-yellow-50 text-yellow-600', text: 'text-yellow-600' },
  { bg: 'bg-purple-50 text-purple-600', text: 'text-purple-600' },
  { bg: 'bg-red-50 text-red-600', text: 'text-red-600' },
  { bg: 'bg-green-50 text-green-600', text: 'text-green-600' },
  { bg: 'bg-slate-50 text-slate-600', text: 'text-slate-600' },
  { bg: 'bg-stone-50 text-stone-600', text: 'text-stone-600' },
  { bg: 'bg-zinc-50 text-zinc-600', text: 'text-zinc-600' },
] as const

export function agentColor(index: number): string {
  return AGENT_COLORS[index % AGENT_COLORS.length].bg
}

export function agentTextColor(index: number): string {
  return AGENT_COLORS[index % AGENT_COLORS.length].text
}
