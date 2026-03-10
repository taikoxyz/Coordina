import { useState, useEffect } from 'react'
import { Input, Button } from '../ui'
import {
  ListEditor, SaveBar, usePatterns,
  toKeyed, cleanArray, cleanString, cleanObj,
  DEFAULT_PATTERNS,
  type KeyedList,
} from './pattern-utils'

export function SoulPatternsSettings() {
  const { storedSettings, saveSettings, saved, save, initialized } = usePatterns()
  const [coreTruths, setCoreTruths] = useState<KeyedList>(toKeyed(DEFAULT_PATTERNS.soul.coreTruths))
  const [continuity, setContinuity] = useState(DEFAULT_PATTERNS.soul.continuity)

  useEffect(() => {
    if (initialized.current || !storedSettings) return
    initialized.current = true
    const p = storedSettings.derivationPatterns?.soul
    if (!p) return
    setCoreTruths(toKeyed(p.coreTruths ?? DEFAULT_PATTERNS.soul.coreTruths))
    setContinuity(p.continuity ?? DEFAULT_PATTERNS.soul.continuity)
  }, [storedSettings])

  const handleSave = () => save((current) => cleanObj({
    ...current,
    soul: cleanObj({ coreTruths: cleanArray(coreTruths), continuity: cleanString(continuity) }),
  }))

  const handleReset = () => {
    setCoreTruths(toKeyed(DEFAULT_PATTERNS.soul.coreTruths))
    setContinuity(DEFAULT_PATTERNS.soul.continuity)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Core truths and continuity instructions injected into SOUL.md.</p>
        <Button variant="ghost" size="sm" onClick={handleReset} className="text-gray-400 hover:text-gray-600">
          Reset to defaults
        </Button>
      </div>
      <hr className="border-gray-200" />
      <ListEditor label="Core Truths" items={coreTruths} onChange={setCoreTruths} />
      <hr className="border-gray-200" />
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-1">Continuity</h4>
        <Input value={continuity} onChange={(e) => setContinuity(e.target.value)} />
      </div>
      <SaveBar onSave={handleSave} isPending={saveSettings.isPending} saved={saved} />
    </div>
  )
}
