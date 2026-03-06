import { useCallback } from 'react'
import type { TeamSpec } from '../../../../shared/types'

interface Props {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
  isEditing: boolean
  onEdit: () => void
  onSave: () => Promise<void>
  isSaving: boolean
}

const inputCls = 'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const monoInputCls = inputCls + ' font-mono'
const labelCls = 'block text-xs font-medium text-gray-600 mb-1'
const valueCls = 'min-h-10 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700'
const emptyValueCls = 'text-gray-400'

function ReadField({ label, value, monospace = false }: { label: string; value?: string | number; monospace?: boolean }) {
  const hasValue = value !== undefined && value !== null && `${value}`.trim().length > 0
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className={`${valueCls} ${monospace ? 'font-mono text-xs' : ''} ${hasValue ? '' : emptyValueCls}`}>
        {hasValue ? value : 'Not set'}
      </div>
    </div>
  )
}

export function TeamOverview({ spec, onSpecChange, isEditing, onEdit, onSave, isSaving }: Props) {
  const set = useCallback((key: keyof TeamSpec) => (value: unknown) => {
    onSpecChange({ ...spec, [key]: value })
  }, [spec, onSpecChange])

  if (!isEditing) {
    return (
      <div className="max-w-3xl space-y-5 py-6 px-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Team overview</h3>
            <p className="text-sm text-gray-500 mt-1">Review the current team configuration before making changes.</p>
          </div>
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Edit team
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Team details</h4>
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Name" value={spec.name} />
              <ReadField label="Slug" value={spec.slug} monospace />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Telegram integration</h4>
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Group ID" value={spec.telegramGroupId} monospace />
              <ReadField label="Admin ID" value={spec.telegramAdminId} monospace />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Infrastructure defaults</h4>
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Default container image" value={spec.defaultImage} monospace />
              <ReadField label="Storage (Gi)" value={spec.defaultDiskGi} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Startup instructions</label>
            <div className={`${valueCls} min-h-28 whitespace-pre-wrap font-mono text-xs ${spec.startupInstructions?.trim() ? '' : emptyValueCls}`}>
              {spec.startupInstructions?.trim() || 'Not set'}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-5 py-6 px-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Edit team</h3>
          <p className="text-sm text-gray-500 mt-1">Update the base team configuration and save when finished.</p>
        </div>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

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
