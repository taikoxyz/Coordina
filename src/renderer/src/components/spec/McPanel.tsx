// Collapsible Mission Control configuration panel for team spec editor
// FEATURE: MC config UI with enable toggle, image/domain inputs, credential management
import { useState, useEffect } from 'react'
import type { TeamSpec, MissionControlConfig } from '../../../../shared/types'

interface Props {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
}

const inputCls = 'bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600 w-full font-mono'
const labelCls = 'text-[10px] text-gray-500 block mb-0.5'

export function McPanel({ spec, onSpecChange }: Props) {
  const mc: MissionControlConfig = spec.missionControl || { enabled: false, image: '' }
  const [adminPassword, setAdminPassword] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [credStatus, setCredStatus] = useState<{ hasCredentials: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.invoke('mc:get-credentials', spec.slug).then((r: unknown) => {
      setCredStatus(r as { hasCredentials: boolean })
    })
  }, [spec.slug])

  const update = (patch: Partial<MissionControlConfig>) => {
    onSpecChange({ ...spec, missionControl: { ...mc, ...patch } })
  }

  const saveCredentials = async () => {
    setSaving(true)
    await window.api.invoke('mc:save-credentials', { teamSlug: spec.slug, adminPassword: adminPassword || undefined, apiKey: apiKey || undefined })
    setAdminPassword('')
    setApiKey('')
    const status = await window.api.invoke('mc:get-credentials', spec.slug) as { hasCredentials: boolean }
    setCredStatus(status)
    setSaving(false)
  }

  return (
    <div className="border border-gray-700/60 rounded p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Mission Control</span>
        <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
          <input type="checkbox" checked={mc.enabled} onChange={e => update({ enabled: e.target.checked })} className="accent-blue-500" />
          Enable
        </label>
      </div>

      {mc.enabled && (
        <div className="space-y-1.5">
          <div>
            <label className={labelCls}>image</label>
            <input className={inputCls} value={mc.image} onChange={e => update({ image: e.target.value })} placeholder="gcr.io/project/mission-control:latest" />
          </div>
          <div>
            <label className={labelCls}>domain</label>
            <input className={inputCls} value={mc.domain ?? ''} onChange={e => update({ domain: e.target.value || undefined })} placeholder={`mc.${spec.domain || 'example.com'}`} />
          </div>

          <div className="border-t border-gray-700/40 pt-1.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-gray-500">Credentials</span>
              {credStatus?.hasCredentials && <span className="text-[10px] text-green-400">configured</span>}
              {credStatus && !credStatus.hasCredentials && <span className="text-[10px] text-yellow-400">not set</span>}
            </div>
            <input type="password" className={inputCls} value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Admin password" />
            <input type="password" className={inputCls + ' mt-1'} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API key" />
            <button
              onClick={saveCredentials}
              disabled={saving || (!adminPassword && !apiKey)}
              className="text-[10px] px-2 py-0.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 rounded mt-1"
            >
              {saving ? 'Saving…' : 'Save Credentials'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
