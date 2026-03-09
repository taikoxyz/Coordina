import { useState, useEffect } from 'react'
import { Input, Label, Button } from '../ui'
import {
  ListEditor, SaveBar, usePatterns,
  toKeyed, cleanArray, cleanString, cleanObj,
  DEFAULT_PATTERNS,
  type KeyedList,
} from './pattern-utils'

export function AgentPatternsSettings() {
  const { storedSettings, saveSettings, saved, save, initialized } = usePatterns()
  const [firstRun, setFirstRun] = useState(DEFAULT_PATTERNS.agents.firstRun)
  const [memoryRules, setMemoryRules] = useState<KeyedList>(toKeyed(DEFAULT_PATTERNS.agents.memoryRules))
  const [safetyRules, setSafetyRules] = useState<KeyedList>(toKeyed(DEFAULT_PATTERNS.agents.safetyRules))
  const [priorities, setPriorities] = useState<KeyedList>(toKeyed(DEFAULT_PATTERNS.agents.priorities))
  const [defaultRule, setDefaultRule] = useState(DEFAULT_PATTERNS.agents.defaultRule)

  useEffect(() => {
    if (initialized.current || !storedSettings) return
    initialized.current = true
    const p = storedSettings.derivationPatterns?.agents
    if (!p) return
    setFirstRun(p.firstRun ?? DEFAULT_PATTERNS.agents.firstRun)
    setMemoryRules(toKeyed(p.memoryRules ?? DEFAULT_PATTERNS.agents.memoryRules))
    setSafetyRules(toKeyed(p.safetyRules ?? DEFAULT_PATTERNS.agents.safetyRules))
    setPriorities(toKeyed(p.priorities ?? DEFAULT_PATTERNS.agents.priorities))
    setDefaultRule(p.defaultRule ?? DEFAULT_PATTERNS.agents.defaultRule)
  }, [storedSettings])

  const handleSave = () => save((current) => cleanObj({
    ...current,
    agents: cleanObj({
      ...current?.agents,
      firstRun: cleanString(firstRun),
      memoryRules: cleanArray(memoryRules),
      safetyRules: cleanArray(safetyRules),
      priorities: cleanArray(priorities),
      defaultRule: cleanString(defaultRule),
    }),
  }))

  const handleReset = () => {
    setFirstRun(DEFAULT_PATTERNS.agents.firstRun)
    setMemoryRules(toKeyed(DEFAULT_PATTERNS.agents.memoryRules))
    setSafetyRules(toKeyed(DEFAULT_PATTERNS.agents.safetyRules))
    setPriorities(toKeyed(DEFAULT_PATTERNS.agents.priorities))
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
      <ListEditor label="Memory Rules" items={memoryRules} onChange={setMemoryRules} />
      <ListEditor label="Safety Rules" items={safetyRules} onChange={setSafetyRules} />
      <ListEditor label="Priorities" items={priorities} onChange={setPriorities} />
      <div>
        <Label>Default Rule</Label>
        <Input value={defaultRule} onChange={(e) => setDefaultRule(e.target.value)} />
      </div>
      <SaveBar onSave={handleSave} isPending={saveSettings.isPending} saved={saved} />
    </div>
  )
}
