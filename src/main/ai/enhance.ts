import Anthropic from '@anthropic-ai/sdk'

export async function enhanceSkills(input: { role: string; skills: string[]; apiKey: string | null }): Promise<string[]> {
  if (!input.apiKey) throw new Error('Anthropic API key not configured')

  const client = new Anthropic({ apiKey: input.apiKey })
  const prompt = `You are helping configure an AI agent with the right skills.
The agent's role is: ${input.role}
Current skills: ${input.skills.join(', ') || '(none)'}

Generate an expanded, comprehensive list of skills for this role. Return ONLY a JSON array of skill strings, no explanation.
Example: ["TypeScript", "React", "Git", "Code review", "Testing"]`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return input.skills

  return JSON.parse(match[0]) as string[]
}

export async function enhanceSoul(input: { role: string; userInput: string; apiKey: string | null }): Promise<string> {
  if (!input.apiKey) throw new Error('Anthropic API key not configured')

  const client = new Anthropic({ apiKey: input.apiKey })
  const prompt = `You are helping write an AI agent's SOUL.md personality description.
The admin provided: "${input.userInput}"
The agent's role is: ${input.role}

Expand this into a richer, more detailed description that captures their personality, working style, and values.
Return only the enhanced description text, no headings or extra formatting.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  return message.content[0].type === 'text' ? message.content[0].text : input.userInput
}
