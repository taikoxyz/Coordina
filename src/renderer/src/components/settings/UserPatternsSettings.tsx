import { useState, useEffect } from 'react'
import {
  SectionTextarea, SaveBar, usePatterns,
  toTextarea, cleanTextarea, cleanObj,
  DEFAULT_PATTERNS,
} from './pattern-utils'

export function UserPatternsSettings() {
  const { storedSettings, saveSettings, saved, save, initialized } = usePatterns()
  const [introLines, setIntroLines] = useState(
    toTextarea(DEFAULT_PATTERNS.user.introLines),
  )

  useEffect(() => {
    if (initialized.current || !storedSettings) return
    initialized.current = true
    const p = storedSettings.derivationPatterns?.user
    if (!p?.introLines) return
    setIntroLines(toTextarea(p.introLines))
  }, [storedSettings])

  const handleSave = () => save((current) => cleanObj({
    ...current,
    user: cleanObj({ introLines: cleanTextarea(introLines) }),
  }))

  const handleReset = () => {
    setIntroLines(toTextarea(DEFAULT_PATTERNS.user.introLines))
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">Intro text injected into USER.md for every agent.</p>
      <SectionTextarea label="Intro Lines" value={introLines} onChange={setIntroLines} />
      <SaveBar onSave={handleSave} isPending={saveSettings.isPending} saved={saved} onReset={handleReset} />
    </div>
  )
}
