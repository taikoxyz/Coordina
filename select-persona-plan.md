# Persona Integration Plan

## Context

Currently, when creating agents in Coordina, users must manually type the **role**, **persona**, and **skills** fields for every agent. This is tedious and error-prone. The [agency-agents](https://github.com/msitarzewski/agency-agents) project provides ~55 pre-built AI agent personas across 9 divisions (Engineering, Design, Marketing, Product, Project Management, Testing, Support, Spatial Computing, Specialized), each with a defined role, personality, and skill set.

This plan adds a grouped dropdown to the AgentRow component that lets users select a persona template, auto-populating role/persona/skills/emoji. Fields remain editable after selection.

## Files to Modify

| File | Action |
|------|--------|
| `src/shared/types.ts` | Add `PersonaTemplate` interface |
| `src/shared/personaCatalog.ts` | **New** — static catalog of ~55 persona templates |
| `src/renderer/src/components/spec/AgentRow.tsx` | Add template `<select>` dropdown |

## Step 1: Add PersonaTemplate type

In `src/shared/types.ts`, add after `AgentSpec` (line 31):

```typescript
export interface PersonaTemplate {
  id: string          // e.g. "engineering-frontend-developer"
  name: string        // e.g. "Frontend Developer"
  division: string    // e.g. "Engineering"
  emoji: string       // e.g. "🎨"
  role: string        // 1-sentence role description
  persona: string     // 2-4 sentence personality for system prompt
  skills: string[]    // 5-8 lowercase keywords
}
```

## Step 2: Create persona catalog

Create `src/shared/personaCatalog.ts` with a static `PERSONA_CATALOG` array. Follows the same `as const` pattern used in `src/shared/agentNames.ts`.

Structure:
```typescript
import type { PersonaTemplate } from './types'

export const PERSONA_CATALOG: readonly PersonaTemplate[] = [
  {
    id: 'engineering-frontend-developer',
    name: 'Frontend Developer',
    division: 'Engineering',
    emoji: '🎨',
    role: 'Frontend developer specializing in React, Vue, Angular, UI implementation, and performance optimization',
    persona: 'Detail-oriented and performance-focused. Approaches every component with accessibility and user experience in mind. Communicates with precision and delivers production-ready code.',
    skills: ['react', 'vue', 'angular', 'css', 'performance', 'accessibility', 'ui-implementation'],
  },
  // ... all ~55 agents across 9 divisions
] as const

export function getPersonasByDivision(): Map<string, PersonaTemplate[]> {
  const grouped = new Map<string, PersonaTemplate[]>()
  for (const p of PERSONA_CATALOG) {
    const list = grouped.get(p.division) ?? []
    list.push(p)
    grouped.set(p.division, list)
  }
  return grouped
}
```

### Extraction methodology

Clone `https://github.com/msitarzewski/agency-agents` to `/tmp/agency-agents`, then for each agent markdown file:

| Target Field | Source | Rule |
|---|---|---|
| `id` | Filename (minus `.md`) | e.g. `engineering-frontend-developer` |
| `name` | Frontmatter `name:` | Use as-is |
| `division` | Parent directory, title-cased | `engineering` → `Engineering` |
| `emoji` | README roster table | Single emoji |
| `role` | Frontmatter `description:` | Condense to 1 sentence, ≤120 chars |
| `persona` | Identity & Memory section (Personality + Memory bullets) | 2-4 sentences, ≤300 chars, suitable for system prompt |
| `skills` | Specialty column + Experience bullets | 5-8 lowercase hyphenated keywords |

### All 55 agents to include

**Engineering (7):** Frontend Developer 🎨, Backend Architect 🏗️, Mobile App Builder 📱, AI Engineer 🤖, DevOps Automator 🚀, Rapid Prototyper ⚡, Senior Developer 💎

**Design (7):** UI Designer 🎯, UX Researcher 🔍, UX Architect 🏛️, Brand Guardian 🎭, Visual Storyteller 📖, Whimsy Injector ✨, Image Prompt Engineer 📷

**Marketing (8):** Growth Hacker 🚀, Content Creator 📝, Twitter Engager 🐦, TikTok Strategist 📱, Instagram Curator 📸, Reddit Community Builder 🤝, App Store Optimizer 📱, Social Media Strategist 🌐

**Product (3):** Sprint Prioritizer 🎯, Trend Researcher 🔍, Feedback Synthesizer 💬

**Project Management (5):** Studio Producer 🎬, Project Shepherd 🐑, Studio Operations ⚙️, Experiment Tracker 🧪, Senior Project Manager 👔

**Testing (7):** Evidence Collector 📸, Reality Checker 🔍, Test Results Analyzer 📊, Performance Benchmarker ⚡, API Tester 🔌, Tool Evaluator 🛠️, Workflow Optimizer 🔄

**Support (6):** Support Responder 💬, Analytics Reporter 📊, Finance Tracker 💰, Infrastructure Maintainer 🏗️, Legal Compliance Checker ⚖️, Executive Summary Generator 📑

**Spatial Computing (6):** XR Interface Architect 🏗️, macOS Spatial/Metal Engineer 💻, XR Immersive Developer 🌐, XR Cockpit Interaction Specialist 🎮, visionOS Spatial Engineer 🍎, Terminal Integration Specialist 🔌

**Specialized (6):** Agents Orchestrator 🎭, Data Analytics Reporter 📊, LSP/Index Engineer 🔍, Sales Data Extraction Agent 📥, Data Consolidation Agent 📈, Report Distribution Agent 📬

## Step 3: Add template dropdown to AgentRow

In `src/renderer/src/components/spec/AgentRow.tsx`:

**3a.** Add `useMemo` to the React import (line 3):
```typescript
import { useEffect, useMemo, useState } from 'react'
```

**3b.** Add imports:
```typescript
import { PERSONA_CATALOG, getPersonasByDivision } from '../../../../shared/personaCatalog'
```

**3c.** Inside the component, add state and handlers (after line 45):
```typescript
const personasByDivision = useMemo(() => getPersonasByDivision(), [])
const [selectedTemplate, setSelectedTemplate] = useState<string>('')

const applyTemplate = (templateId: string) => {
  setSelectedTemplate(templateId)
  if (templateId === 'custom') {
    onChange({ ...agent, role: '', emoji: '', persona: '', skills: [] })
    return
  }
  if (!templateId) return
  const tmpl = PERSONA_CATALOG.find(p => p.id === templateId)
  if (!tmpl) return
  onChange({ ...agent, role: tmpl.role, emoji: tmpl.emoji, persona: tmpl.persona, skills: tmpl.skills })
}

const isCustom = selectedTemplate === 'custom'
```

**3d.** Insert grouped `<select>` between the name field (line 120) and the role field (line 121). Uses native `<select>` + `<optgroup>` — matches the existing provider dropdown pattern (lines 159-167), and follows the [grouped select pattern from component.gallery](https://component.gallery/components/select/):

```tsx
<div className="flex items-center gap-2">
  <label className="text-[10px] text-gray-500 w-20 shrink-0">template</label>
  <select
    value={selectedTemplate}
    onChange={e => applyTemplate(e.target.value)}
    className="flex-1 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600"
  >
    <option value="">— select persona —</option>
    <option value="custom">Custom (manual entry)</option>
    {Array.from(personasByDivision.entries()).map(([division, templates]) => (
      <optgroup key={division} label={division}>
        {templates.map(t => (
          <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
        ))}
      </optgroup>
    ))}
  </select>
</div>
```

**3e.** Conditionally render the role, emoji, persona, and skills fields based on selection mode:

- **No selection yet** (`selectedTemplate === ''`): hide role/persona/skills fields (user must pick a template or "Custom" first)
- **"Custom" selected**: show all fields as editable free-text inputs (current behavior — role input, emoji input, persona textarea, skills comma-separated input)
- **Template selected**: show all fields as editable inputs, pre-filled with template values (user can still override)

```tsx
{(selectedTemplate) && (
  <>
    {fieldRow('role', agent.role, set('role'), { placeholder: 'Researcher' })}
    {fieldRow('emoji', agent.emoji ?? '', v => set('emoji')(v || undefined), { placeholder: '🤖' })}
    {fieldRow('persona', agent.persona, set('persona'), { multiline: true, placeholder: "Describe this agent's personality..." })}
    <div className="flex items-center gap-2">
      <label className="text-[10px] text-gray-500 w-20 shrink-0">skills</label>
      <input
        type="text"
        value={agent.skills.join(', ')}
        onChange={e => set('skills')(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
        placeholder="research, writing"
        className="flex-1 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600"
      />
    </div>
  </>
)}
```

Key design choices:
- The dropdown is now **stateful** (`selectedTemplate`) — it remembers what was picked and controls field visibility
- **"Custom" option** is the first option after the placeholder, clears all persona fields and shows empty editable inputs
- **Template option** pre-fills fields but keeps them editable
- **No selection** hides persona fields to guide the user — pick a template or "Custom" first
- Role/emoji/persona/skills fields are moved inside a conditional block gated by `selectedTemplate`
- Native `<select>` with `<optgroup>` for division grouping — no custom component needed
- Matches existing dense styling (text-[10px] label, text-[11px] select, gray-800 bg)
- Preserves name, slug, provider, and all infrastructure fields on template apply

## What this does NOT include (YAGNI)

- No search/filter (55 items in grouped optgroups is navigable)
- No persistent `templateId` on AgentSpec (one-shot fill, not tracked state)
- No runtime GitHub fetching (static data)
- No custom combobox (native select suffices)
- No backend/main process changes
- No preview tooltip before selection

## Verification

1. `npm run typecheck` — confirm no type errors
2. `npm run dev` — open app, create/edit a team
3. Expand an agent row → see "template" dropdown between name and role
4. Confirm "— select persona —" placeholder hides role/persona/skills fields
5. Select "Custom (manual entry)" → confirm empty role, emoji, persona, skills fields appear and are freely editable
6. Select a template persona → confirm role, emoji, persona, skills auto-fill
7. Edit a pre-filled field → confirm it stays editable
8. Switch from a template to "Custom" → confirm fields clear to empty
9. Switch from "Custom" to a template → confirm fields populate
10. Confirm existing provider dropdown still works
