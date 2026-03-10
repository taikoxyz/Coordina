import { useState, useEffect } from 'react'
import { Input } from '../ui'
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
  const [defaultRules, setDefaultRules] = useState(toTextarea(DEFAULT_PATTERNS.agents.defaultRules))

  useEffect(() => {
    if (initialized.current || !storedSettings) return
    initialized.current = true
    const p = storedSettings.derivationPatterns?.agents
    if (!p) return
    setFirstRun(p.firstRun ?? DEFAULT_PATTERNS.agents.firstRun)
    setMemoryRules(toTextarea(p.memoryRules ?? DEFAULT_PATTERNS.agents.memoryRules))
    setSafetyRules(toTextarea(p.safetyRules ?? DEFAULT_PATTERNS.agents.safetyRules))
    setPriorities(toTextarea(p.priorities ?? DEFAULT_PATTERNS.agents.priorities))
    setDefaultRules(toTextarea(p.defaultRules ?? DEFAULT_PATTERNS.agents.defaultRules))
  }, [storedSettings])

  const handleSave = () => save((current) => cleanObj({
    ...current,
    agents: cleanObj({
      ...current?.agents,
      firstRun: cleanString(firstRun),
      memoryRules: cleanTextarea(memoryRules),
      safetyRules: cleanTextarea(safetyRules),
      priorities: cleanTextarea(priorities),
      defaultRules: cleanTextarea(defaultRules),
    }),
  }))

  const handleReset = () => {
    setFirstRun(DEFAULT_PATTERNS.agents.firstRun)
    setMemoryRules(toTextarea(DEFAULT_PATTERNS.agents.memoryRules))
    setSafetyRules(toTextarea(DEFAULT_PATTERNS.agents.safetyRules))
    setPriorities(toTextarea(DEFAULT_PATTERNS.agents.priorities))
    setDefaultRules(toTextarea(DEFAULT_PATTERNS.agents.defaultRules))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Rules and instructions injected into AGENTS.md for every agent.</p>
      <hr className="border-gray-200" />
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-1">First Run</h4>
        <Input value={firstRun} onChange={(e) => setFirstRun(e.target.value)} />
      </div>
      <hr className="border-gray-200" />
      <SectionTextarea label="Memory Rules" value={memoryRules} onChange={setMemoryRules} />
      <hr className="border-gray-200" />
      <SectionTextarea label="Safety Rules" value={safetyRules} onChange={setSafetyRules} />
      <hr className="border-gray-200" />
      <SectionTextarea label="Priorities" value={priorities} onChange={setPriorities} />
      <hr className="border-gray-200" />
      <SectionTextarea label="Default Rules" value={defaultRules} onChange={setDefaultRules} />
      <SaveBar onSave={handleSave} isPending={saveSettings.isPending} saved={saved} onReset={handleReset} />
    </div>
  )
}
