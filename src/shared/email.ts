export function deriveAgentEmail(teamEmail: string, agentSlug: string, isLead: boolean): string {
  if (isLead) return teamEmail
  const atIndex = teamEmail.indexOf('@')
  if (atIndex === -1) return teamEmail
  return `${teamEmail.slice(0, atIndex)}+${agentSlug}${teamEmail.slice(atIndex)}`
}
