import { useState, useEffect } from 'react'
import { Button } from '../ui'
import {
  ListEditor, SaveBar, usePatterns,
  toKeyed, cleanArray, cleanObj,
  DEFAULT_PATTERNS,
  type KeyedList,
} from './pattern-utils'

export function UserPatternsSettings() {
  const { storedSettings, saveSettings, saved, save, initialized } = usePatterns()
  const [introLines, setIntroLines] = useState<KeyedList>(
    toKeyed(DEFAULT_PATTERNS.user.introLines),
  )

  useEffect(() => {
    if (initialized.current || !storedSettings) return
    initialized.current = true
    const p = storedSettings.derivationPatterns?.user
    if (!p?.introLines) return
    setIntroLines(toKeyed(p.introLines))
  }, [storedSettings])

  const handleSave = () => save((current) => cleanObj({
    ...current,
    user: cleanObj({ introLines: cleanArray(introLines) }),
  }))

  const handleReset = () => {
    setIntroLines(toKeyed(DEFAULT_PATTERNS.user.introLines))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Intro text injected into USER.md for every agent.</p>
        <Button variant="ghost" size="sm" onClick={handleReset} className="text-gray-400 hover:text-gray-600">
          Reset to defaults
        </Button>
      </div>
      <hr className="border-gray-200" />
      <ListEditor label="Intro Lines" items={introLines} onChange={setIntroLines} />
      <SaveBar onSave={handleSave} isPending={saveSettings.isPending} saved={saved} />
    </div>
  )
}
