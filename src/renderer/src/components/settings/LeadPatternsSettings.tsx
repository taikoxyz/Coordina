import { useState, useEffect } from 'react'
import { Button } from '../ui'
import {
  ListEditor, SaveBar, usePatterns,
  toKeyed, cleanArray, cleanObj,
  DEFAULT_PATTERNS,
  type KeyedList,
} from './pattern-utils'

export function LeadPatternsSettings() {
  const { storedSettings, saveSettings, saved, save, initialized } = usePatterns()
  const [responsibilities, setResponsibilities] = useState<KeyedList>(
    toKeyed(DEFAULT_PATTERNS.agents.teamLeadResponsibilities),
  )

  useEffect(() => {
    if (initialized.current || !storedSettings) return
    initialized.current = true
    const p = storedSettings.derivationPatterns?.agents
    if (!p?.teamLeadResponsibilities) return
    setResponsibilities(toKeyed(p.teamLeadResponsibilities))
  }, [storedSettings])

  const handleSave = () => save((current) => cleanObj({
    ...current,
    agents: cleanObj({
      ...current?.agents,
      teamLeadResponsibilities: cleanArray(responsibilities),
    }),
  }))

  const handleReset = () => {
    setResponsibilities(toKeyed(DEFAULT_PATTERNS.agents.teamLeadResponsibilities))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Responsibilities injected into AGENTS.md for agents marked as team lead.</p>
        <Button variant="ghost" size="sm" onClick={handleReset} className="text-gray-400 hover:text-gray-600">
          Reset to defaults
        </Button>
      </div>
      <ListEditor label="Responsibilities" items={responsibilities} onChange={setResponsibilities} />
      <SaveBar onSave={handleSave} isPending={saveSettings.isPending} saved={saved} />
    </div>
  )
}
