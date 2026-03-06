import { useCallback } from 'react'
import type { TeamSpec } from '../../../../shared/types'

interface Props {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
}

const inputCls = 'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const monoInputCls = inputCls + ' font-mono'
const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

export function TeamOverview({ spec, onSpecChange }: Props) {
  const set = useCallback((key: keyof TeamSpec) => (value: unknown) => {
    onSpecChange({ ...spec, [key]: value })
  }, [spec, onSpecChange])

  return (
    <div className="max-w-xl space-y-5 py-6 px-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Team details</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={spec.name} onChange={e => set('name')(e.target.value)} placeholder="My Team" />
          </div>
          <div>
            <label className={labelCls}>Slug</label>
            <input className={monoInputCls} value={spec.slug} onChange={e => set('slug')(e.target.value)} placeholder="my-team" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Telegram integration</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Group ID</label>
            <input
              className={monoInputCls}
              value={spec.telegramGroupId ?? ''}
              onChange={e => set('telegramGroupId')(e.target.value || undefined)}
              placeholder="-1001234567890"
            />
          </div>
          <div>
            <label className={labelCls}>Admin ID</label>
            <input
              className={monoInputCls}
              value={spec.telegramAdminId ?? ''}
              onChange={e => set('telegramAdminId')(e.target.value || undefined)}
              placeholder="123456789"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Infrastructure defaults</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Default container image</label>
            <input
              className={monoInputCls}
              value={spec.defaultImage ?? ''}
              onChange={e => set('defaultImage')(e.target.value || undefined)}
              placeholder="ghcr.io/org/openclaw:latest"
            />
          </div>
          <div>
            <label className={labelCls}>Storage (Gi)</label>
            <input
              type="number"
              min={1}
              className={inputCls}
              value={spec.defaultDiskGi ?? ''}
              onChange={e => set('defaultDiskGi')(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              placeholder="100"
            />
          </div>
        </div>
      </div>

      <div>
        <label className={labelCls}>Startup instructions</label>
        <textarea
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono"
          rows={4}
          value={spec.startupInstructions ?? ''}
          onChange={e => set('startupInstructions')(e.target.value || undefined)}
          placeholder="Custom startup instructions..."
        />
      </div>
    </div>
  )
}
