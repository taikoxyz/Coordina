import { useState, useRef } from 'react'
import type { DerivationPatterns } from '../../../../shared/types'
import { DEFAULT_PATTERNS } from '../../../../shared/derivationDefaults'
import { useSaveSettings, useSettings } from '../../hooks/useSettings'
import { Button, Label, Textarea } from '../ui'

export type KeyedList = Array<{ id: number; value: string }>

let nextId = 0
export const toKeyed = (items: string[] | undefined): KeyedList =>
  (items ?? []).map((value) => ({ id: nextId++, value }))
export const fromKeyed = (items: KeyedList): string[] =>
  items.map((item) => item.value)
export const addKeyed = (items: KeyedList): KeyedList =>
  [...items, { id: nextId++, value: '' }]

export const cleanArray = (keyed: KeyedList): string[] | undefined => {
  const filtered = fromKeyed(keyed).filter((s) => s.trim() !== '')
  return filtered.length > 0 ? filtered : undefined
}

export const toTextarea = (items: string[] | undefined): string => (items ?? []).join('\n')

export const cleanTextarea = (text: string): string[] | undefined => {
  const filtered = text.split('\n').filter((s) => s.trim() !== '')
  return filtered.length > 0 ? filtered : undefined
}

export const cleanString = (s: string | undefined): string | undefined =>
  s?.trim() || undefined

export const cleanObj = <T extends Record<string, unknown>>(o: T): T | undefined => {
  const entries = Object.entries(o).filter(([, v]) => v !== undefined)
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined
}

export function SectionTextarea({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  const lineCount = value ? value.split('\n').length : 1
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Textarea
        className="text-xs font-mono"
        rows={Math.max(3, lineCount + 1)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function ListEditor({
  items,
  onChange,
  label,
}: {
  items: KeyedList
  onChange: (items: KeyedList) => void
  label: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {items.map((item, i) => (
        <div key={item.id} className="flex gap-2 items-start">
          <span className="text-xs text-gray-400 mt-2 w-5 shrink-0 text-right">{i + 1}.</span>
          <Textarea
            rows={2}
            className="min-h-0 text-xs"
            value={item.value}
            onChange={(e) => {
              const next = [...items]
              next[i] = { ...item, value: e.target.value }
              onChange(next)
            }}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-gray-400 hover:text-red-500 text-xs mt-2 shrink-0"
          >
            &times;
          </button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange(addKeyed(items))}
      >
        + Add item
      </Button>
    </div>
  )
}

export function SaveBar({
  onSave,
  isPending,
  saved,
  onReset,
}: {
  onSave: () => void
  isPending: boolean
  saved: boolean
  onReset?: () => void
}) {
  return (
    <div className="space-y-2 pt-4">
      <div className="flex items-center gap-3">
        <Button variant="primary" size="lg" onClick={onSave} disabled={isPending}>
          {isPending ? 'Saving...' : saved ? 'Saved' : 'Save changes'}
        </Button>
        {onReset && (
          <Button variant="ghost" size="sm" onClick={onReset} className="text-gray-400 hover:text-gray-600">
            Reset to defaults
          </Button>
        )}
      </div>
      <p className="text-xs text-gray-400">Re-deploy your team for changes to take effect.</p>
    </div>
  )
}

export function usePatterns() {
  const { data: storedSettings } = useSettings()
  const saveSettings = useSaveSettings()
  const [saved, setSaved] = useState(false)
  const initialized = useRef(false)

  const save = async (updater: (current?: DerivationPatterns) => DerivationPatterns | undefined) => {
    const current = storedSettings?.derivationPatterns
    const patterns = updater(current)
    await saveSettings.mutateAsync({ ...storedSettings, derivationPatterns: patterns })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return { storedSettings, saveSettings, saved, save, initialized }
}

export { DEFAULT_PATTERNS }
