import { useState, useEffect } from 'react'
import { Input, Label, Button } from '../ui'
import {
  SectionTextarea, SaveBar, usePatterns,
  toTextarea, cleanTextarea, cleanString, cleanObj,
  DEFAULT_PATTERNS,
} from './pattern-utils'

export function AgentPatternsSettings() {
  const { storedSettings, saveSettings, saved, save, initialized } = usePatterns()
  const [firstRun, setFirstRun] = useState(DEFAULT_PATTERNS.agents.firstRun)
  const [memoryRules, setMemoryRules] = useState(toTextarea(DEFAULT_PATTERNS.agents.memoryRules))
  const [safetyRules, setSafetyRules] = useState(toTextarea(DEFAULT_PATTERNS.agents.safetyRules))
  const [priorities, setPriorities] = useState(toTextarea(DEFAULT_PATTERNS.agents.priorities))
  const [defaultRule, setDefaultRule] = useState(DEFAULT_PATTERNS.agents.defaultRule)

  useEffect(() => {
    if (initialized.current || !storedSettings) return
    initialized.current = true
    const p = storedSettings.derivationPatterns?.agents
    if (!p) return
    setFirstRun(p.firstRun ?? DEFAULT_PATTERNS.agents.firstRun)
    setMemoryRules(toTextarea(p.memoryRules ?? DEFAULT_PATTERNS.agents.memoryRules))
    setSafetyRules(toTextarea(p.safetyRules ?? DEFAULT_PATTERNS.agents.safetyRules))
    setPriorities(toTextarea(p.priorities ?? DEFAULT_PATTERNS.agents.priorities))
    setDefaultRule(p.defaultRule ?? DEFAULT_PATTERNS.agents.defaultRule)
  }, [storedSettings])

  const handleSave = () => save((current) => cleanObj({
    ...current,
    agents: cleanObj({
      ...current?.agents,
      firstRun: cleanString(firstRun),
      memoryRules: cleanTextarea(memoryRules),
      safetyRules: cleanTextarea(safetyRules),
      priorities: cleanTextarea(priorities),
      defaultRule: cleanString(defaultRule),
    }),
  }))

  const handleReset = () => {
    setFirstRun(DEFAULT_PATTERNS.agents.firstRun)
    setMemoryRules(toTextarea(DEFAULT_PATTERNS.agents.memoryRules))
    setSafetyRules(toTextarea(DEFAULT_PATTERNS.agents.safetyRules))
    setPriorities(toTextarea(DEFAULT_PATTERNS.agents.priorities))
    setDefaultRule(DEFAULT_PATTERNS.agents.defaultRule)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Rules and instructions injected into AGENTS.md for every agent.</p>
        <Button variant="ghost" size="sm" onClick={handleReset} className="text-gray-400 hover:text-gray-600">
          Reset to defaults
        </Button>
      </div>
      <div>
        <Label>First Run</Label>
        <Input value={firstRun} onChange={(e) => setFirstRun(e.target.value)} />
      </div>
      <SectionTextarea label="Memory Rules" value={memoryRules} onChange={setMemoryRules} />
      <SectionTextarea label="Safety Rules" value={safetyRules} onChange={setSafetyRules} />
      <SectionTextarea label="Priorities" value={priorities} onChange={setPriorities} />
      <div>
        <Label>Default Rule</Label>
        <Input value={defaultRule} onChange={(e) => setDefaultRule(e.target.value)} />
      </div>
      <SaveBar onSave={handleSave} isPending={saveSettings.isPending} saved={saved} />
    </div>
  )
}
