import { useCallback } from 'react'
import { Pencil, FileJson } from 'lucide-react'
import type { TeamSpec } from '../../../shared/types'
import { Button, Input, Label, ReadField, Textarea } from './ui'

export interface SpecEditorProps {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => Promise<void>
  isSaving: boolean
  onShowJson: () => void
}

export function SpecEditor({ spec, onSpecChange, isEditing, onEdit, onCancel, onSave, isSaving, onShowJson }: SpecEditorProps) {
  const set = useCallback(
    (key: keyof TeamSpec) => (value: unknown) => {
      onSpecChange({ ...spec, [key]: value })
    },
    [spec, onSpecChange],
  )

  if (!isEditing) {
    return (
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-2xl mx-auto space-y-4 py-6 px-6">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
              Team overview
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={onShowJson} title="View JSON">
                <FileJson className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onEdit} title="Edit team">
                <Pencil className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Team details</h4>
            <ReadField label="Name" value={spec.name} />
            <ReadField label="Slug" value={spec.slug} monospace />
            <ReadField label="Agents" value={spec.agents.length} />
          </div>

          <hr className="border-gray-200" />

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Telegram integration</h4>
            <ReadField label="Group ID" value={spec.telegramGroupId} monospace />
            <ReadField label="Admin ID" value={spec.telegramAdminId} monospace />
          </div>

          <hr className="border-gray-200" />

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Infrastructure defaults</h4>
            <ReadField label="Default container image" value={spec.defaultImage} monospace />
            <ReadField label="Storage (Gi)" value={spec.defaultDiskGi} />
          </div>

          <hr className="border-gray-200" />

          <ReadField label="Startup instructions" value={spec.startupInstructions?.trim() || undefined} monospace />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-2xl mx-auto space-y-5 py-6 px-6">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
            Edit team
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void onSave()}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="secondary" size="sm" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Team details</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={spec.name} onChange={(e) => set('name')(e.target.value)} placeholder="My Team" />
            </div>
            <div>
              <Label>Slug</Label>
              <Input mono value={spec.slug} onChange={(e) => set('slug')(e.target.value)} placeholder="my-team" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Telegram integration</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Group ID</Label>
              <Input
                mono
                value={spec.telegramGroupId ?? ''}
                onChange={(e) => set('telegramGroupId')(e.target.value || undefined)}
                placeholder="-1001234567890"
              />
            </div>
            <div>
              <Label>Admin ID</Label>
              <Input
                mono
                value={spec.telegramAdminId ?? ''}
                onChange={(e) => set('telegramAdminId')(e.target.value || undefined)}
                placeholder="123456789"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Infrastructure defaults</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Default container image</Label>
              <Input
                mono
                value={spec.defaultImage ?? ''}
                onChange={(e) => set('defaultImage')(e.target.value || undefined)}
                placeholder="ghcr.io/org/openclaw:latest"
              />
            </div>
            <div>
              <Label>Storage (Gi)</Label>
              <Input
                type="number"
                min={1}
                value={spec.defaultDiskGi ?? ''}
                onChange={(e) => set('defaultDiskGi')(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                placeholder="100"
              />
            </div>
          </div>
        </div>

        <div>
          <Label>Startup instructions</Label>
          <Textarea
            mono
            rows={4}
            value={spec.startupInstructions ?? ''}
            onChange={(e) => set('startupInstructions')(e.target.value || undefined)}
            placeholder="Custom startup instructions..."
          />
        </div>
      </div>
    </div>
  )
}
