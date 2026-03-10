import { useState, useEffect } from 'react'
import {
  SectionTextarea, SaveBar, usePatterns,
  toTextarea, cleanTextarea, cleanObj,
  DEFAULT_PATTERNS,
} from './pattern-utils'

export function LeadPatternsSettings() {
  const { storedSettings, saveSettings, saved, save, initialized } = usePatterns()
  const [responsibilities, setResponsibilities] = useState(
    toTextarea(DEFAULT_PATTERNS.agents.teamLeadResponsibilities),
  )

  useEffect(() => {
    if (initialized.current || !storedSettings) return
    initialized.current = true
    const p = storedSettings.derivationPatterns?.agents
    if (!p?.teamLeadResponsibilities) return
    setResponsibilities(toTextarea(p.teamLeadResponsibilities))
  }, [storedSettings])

  const handleSave = () => save((current) => cleanObj({
    ...current,
    agents: cleanObj({
      ...current?.agents,
      teamLeadResponsibilities: cleanTextarea(responsibilities),
    }),
  }))

  const handleReset = () => {
    setResponsibilities(toTextarea(DEFAULT_PATTERNS.agents.teamLeadResponsibilities))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Responsibilities injected into AGENTS.md for agents marked as team lead.</p>
      <hr className="border-gray-200" />
      <SectionTextarea label="Responsibilities" value={responsibilities} onChange={setResponsibilities} />
      <SaveBar onSave={handleSave} isPending={saveSettings.isPending} saved={saved} onReset={handleReset} />
    </div>
  )
}
