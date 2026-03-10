import { useState, useEffect } from 'react'
import { Input, Label, Button } from '../ui'
import {
  SectionTextarea, SaveBar, usePatterns,
  toTextarea, cleanTextarea, cleanString, cleanObj,
  DEFAULT_PATTERNS,
} from './pattern-utils'

export function SoulPatternsSettings() {
  const { storedSettings, saveSettings, saved, save, initialized } = usePatterns()
  const [coreTruths, setCoreTruths] = useState(toTextarea(DEFAULT_PATTERNS.soul.coreTruths))
  const [continuity, setContinuity] = useState(DEFAULT_PATTERNS.soul.continuity)

  useEffect(() => {
    if (initialized.current || !storedSettings) return
    initialized.current = true
    const p = storedSettings.derivationPatterns?.soul
    if (!p) return
    setCoreTruths(toTextarea(p.coreTruths ?? DEFAULT_PATTERNS.soul.coreTruths))
    setContinuity(p.continuity ?? DEFAULT_PATTERNS.soul.continuity)
  }, [storedSettings])

  const handleSave = () => save((current) => cleanObj({
    ...current,
    soul: cleanObj({ coreTruths: cleanTextarea(coreTruths), continuity: cleanString(continuity) }),
  }))

  const handleReset = () => {
    setCoreTruths(toTextarea(DEFAULT_PATTERNS.soul.coreTruths))
    setContinuity(DEFAULT_PATTERNS.soul.continuity)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Core truths and continuity instructions injected into SOUL.md.</p>
        <Button variant="ghost" size="sm" onClick={handleReset} className="text-gray-400 hover:text-gray-600">
          Reset to defaults
        </Button>
      </div>
      <SectionTextarea label="Core Truths" value={coreTruths} onChange={setCoreTruths} />
      <div>
        <Label>Continuity</Label>
        <Input value={continuity} onChange={(e) => setContinuity(e.target.value)} />
      </div>
      <SaveBar onSave={handleSave} isPending={saveSettings.isPending} saved={saved} />
    </div>
  )
}
