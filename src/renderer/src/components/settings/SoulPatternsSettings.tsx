import { useState, useEffect } from 'react'
import { Input } from '../ui'
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
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Core truths and continuity instructions injected into SOUL.md.</p>
      <hr className="border-gray-200" />
      <SectionTextarea label="Core Truths" value={coreTruths} onChange={setCoreTruths} />
      <hr className="border-gray-200" />
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-1">Continuity</h4>
        <Input value={continuity} onChange={(e) => setContinuity(e.target.value)} />
      </div>
      <SaveBar onSave={handleSave} isPending={saveSettings.isPending} saved={saved} onReset={handleReset} />
    </div>
  )
}
