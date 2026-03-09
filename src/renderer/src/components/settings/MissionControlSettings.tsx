import { useEffect, useState } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { useGkeConfig, useSaveGkeConfig } from '../../hooks/useEnvironments'
import { Button, Input, Label } from '../ui'

export function MissionControlSettings() {
  const { data: gkeConfig } = useGkeConfig()
  const saveConfig = useSaveGkeConfig()
  const [enabled, setEnabled] = useState(false)
  const [image, setImage] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (gkeConfig?.config) {
      const mc = (gkeConfig.config as Record<string, unknown>).missionControl as Record<string, unknown> | undefined
      setEnabled(mc?.enabled === true)
      setImage((mc?.image as string) ?? '')
    }
  }, [gkeConfig])

  const handleSave = async () => {
    setError(null)
    try {
      const base = gkeConfig?.config as Record<string, unknown> ?? {}
      await saveConfig.mutateAsync({
        ...base,
        missionControl: enabled ? { enabled: true, image } : undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">Deploy a Mission Control monitoring dashboard alongside each team's agents.</p>
          <p className="text-xs text-gray-400 mt-1">Admin password and session secret are derived per-team from the team signing key.</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <div className="w-8 h-4 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-4 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all" />
        </label>
      </div>

      {enabled && (
        <div>
          <Label>Docker image</Label>
          <Input
            mono
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="ghcr.io/builderz-labs/mission-control:latest"
          />
          <p className="text-xs text-gray-400 mt-0.5">Default: ghcr.io/builderz-labs/mission-control:latest</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saveConfig.isPending}>
        {saveConfig.isPending ? 'Saving...' : saved ? <><Check className="w-3 h-3 mr-1" />Saved</> : 'Save'}
      </Button>
    </div>
  )
}
