import { generateText } from 'ai'
import type { LanguageModel } from 'ai'

export async function enhanceSkills(input: { role: string; skills: string[]; model: LanguageModel }): Promise<string[]> {
  const prompt = `You are helping configure an AI agent with the right skills.
The agent's role is: ${input.role}
Current skills: ${input.skills.join(', ') || '(none)'}

Generate an expanded, comprehensive list of skills for this role. Return ONLY a JSON array of skill strings, no explanation.
Example: ["TypeScript", "React", "Git", "Code review", "Testing"]`

  const { text } = await generateText({ model: input.model, prompt, maxOutputTokens: 512 })
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return input.skills
  return JSON.parse(match[0]) as string[]
}

export async function enhanceSoul(input: { role: string; userInput: string; model: LanguageModel }): Promise<string> {
  const prompt = `You are helping write an AI agent's SOUL.md personality description.
The admin provided: "${input.userInput}"
The agent's role is: ${input.role}

Expand this into a richer, more detailed description that captures their personality, working style, and values.
Return only the enhanced description text, no headings or extra formatting.`

  const { text } = await generateText({ model: input.model, prompt, maxOutputTokens: 1024 })
  return text || input.userInput
}
