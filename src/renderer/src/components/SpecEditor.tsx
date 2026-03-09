import { useCallback, useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import type { TeamSpec } from '../../../shared/types'
import { Button, Input, Label, ReadField, Textarea } from './ui'

export interface SpecEditorProps {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => Promise<void>
  onDelete: () => void
  isSaving: boolean
}

export function SpecEditor({ spec, onSpecChange, isEditing, onEdit, onCancel, onSave, onDelete, isSaving }: SpecEditorProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = useCallback(
    (key: keyof TeamSpec) => (value: unknown) => {
      onSpecChange({ ...spec, [key]: value })
    },
    [spec, onSpecChange],
  )

  const [emailPassword, setEmailPassword] = useState('')
  const [emailPasswordMasked, setEmailPasswordMasked] = useState<string | null>(null)
  const [emailPasswordBusy, setEmailPasswordBusy] = useState(false)
  const [emailPasswordError, setEmailPasswordError] = useState<string | null>(null)

  useEffect(() => {
    if (!spec.slug || !spec.teamEmail) { setEmailPasswordMasked(null); return }
    let active = true
    window.api
      .invoke('teams:getTeamEmailPasswordMasked', { teamSlug: spec.slug })
      .then((value) => { if (active) setEmailPasswordMasked((value as string | null) ?? null) })
      .catch((e) => { if (active) setEmailPasswordError((e as Error).message) })
    return () => { active = false }
  }, [spec.slug, spec.teamEmail])

  const saveEmailPassword = async () => {
    setEmailPasswordBusy(true)
    setEmailPasswordError(null)
    try {
      await window.api.invoke('teams:setTeamEmailPassword', { teamSlug: spec.slug, password: emailPassword })
      const masked = (await window.api.invoke('teams:getTeamEmailPasswordMasked', { teamSlug: spec.slug })) as string | null
      setEmailPasswordMasked(masked)
      setEmailPassword('')
    } catch (e) {
      setEmailPasswordError((e as Error).message)
    } finally {
      setEmailPasswordBusy(false)
    }
  }

  const clearEmailPassword = async () => {
    setEmailPasswordBusy(true)
    setEmailPasswordError(null)
    try {
      await window.api.invoke('teams:setTeamEmailPassword', { teamSlug: spec.slug, password: '' })
      setEmailPasswordMasked(null)
      setEmailPassword('')
    } catch (e) {
      setEmailPasswordError((e as Error).message)
    } finally {
      setEmailPasswordBusy(false)
    }
  }

  if (!isEditing) {
    return (
      <>
        <div className="shrink-0 border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-6 h-11 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
              {spec.name || 'Team overview'}
            </div>
            <Button variant="ghost" size="icon" onClick={onEdit} title="Edit team">
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-2xl mx-auto space-y-4 py-4 px-6">
            <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">About</h4>
            <ReadField label="Slug" value={spec.slug} monospace />
            <ReadField label="Agents" value={spec.agents.length} />
          </div>

          <hr className="border-gray-200" />

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Telegram</h4>
            <ReadField label="Group ID" value={spec.telegramGroupId} monospace />
            <ReadField label="Admin ID" value={spec.telegramAdminId} monospace />
          </div>

          <hr className="border-gray-200" />

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Gmail</h4>
            <ReadField label="Team email" value={spec.teamEmail} monospace />
            <ReadField label="App password" value={emailPasswordMasked ?? undefined} monospace />
            {emailPasswordError && (
              <p className="text-xs text-red-600 mt-0.5">{emailPasswordError}</p>
            )}
          </div>

          <hr className="border-gray-200" />

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Resources</h4>
            <ReadField label="Container image" value={spec.defaultImage} />
            <ReadField label="CPU (cores)" value={spec.defaultCpu} defaultValue={1} />
            <ReadField label="Disk (Gi)" value={spec.defaultDiskGi} defaultValue={10} />
          </div>

          <hr className="border-gray-200" />

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">OpenClaw</h4>
            <ReadField label="Bootstrap" value={spec.startupInstructions?.trim() || undefined} monospace full />
          </div>
        </div>
      </div>
      </>
    )
  }

  return (
    <>
      <div className="shrink-0 border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-6 h-11 flex items-center gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
            Edit team
          </div>
          <div className="flex-1" />
          <Button
            variant="primary"
            size="sm"
            onClick={() => void onSave()}
            disabled={isSaving || !spec.name.trim() || !spec.slug.trim()}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          {confirmDelete ? (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Confirm delete
            </Button>
          ) : (
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => { setConfirmDelete(false); onCancel() }} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-2xl mx-auto space-y-5 py-4 px-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Telegram</h3>
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
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Gmail</h3>
          <div className="space-y-3">
            <div>
              <Label>Team email</Label>
              <Input
                mono
                value={spec.teamEmail ?? ''}
                onChange={(e) => set('teamEmail')(e.target.value || undefined)}
                placeholder="team@gmail.com"
              />
              <p className="text-xs text-gray-400 mt-0.5">Agents get plus-addressed variants (e.g., team+agent-slug@gmail.com)</p>
            </div>
            <div>
              <Label>App password</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  mono
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder={emailPasswordMasked ? 'Update password' : 'Google app password'}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void saveEmailPassword()}
                  disabled={emailPasswordBusy || !spec.slug || !spec.teamEmail}
                  className="shrink-0"
                >
                  Save
                </Button>
                {emailPasswordMasked && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void clearEmailPassword()}
                    disabled={emailPasswordBusy}
                    className="shrink-0"
                  >
                    Clear
                  </Button>
                )}
              </div>
              {emailPasswordMasked && (
                <p className="text-xs text-gray-400 font-mono mt-0.5">{emailPasswordMasked}</p>
              )}
              {emailPasswordError && (
                <p className="text-xs text-red-600 mt-0.5">{emailPasswordError}</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Resources</h3>
          <div className="space-y-3">
            <div>
              <Label>Container image</Label>
              <Input
                mono
                value={spec.defaultImage ?? ''}
                onChange={(e) => set('defaultImage')(e.target.value || undefined)}
                placeholder="ghcr.io/org/openclaw:latest"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPU (cores)</Label>
                <Input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={spec.defaultCpu ?? ''}
                  onChange={(e) => set('defaultCpu')(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="1"
                />
              </div>
              <div>
                <Label>Disk (Gi)</Label>
                <Input
                  type="number"
                  min={1}
                  value={spec.defaultDiskGi ?? ''}
                  onChange={(e) => set('defaultDiskGi')(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  placeholder="10"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">OpenClaw</h3>
          <div>
            <Label>Bootstrap</Label>
            <Textarea
              mono
              rows={4}
              value={spec.startupInstructions ?? ''}
              onChange={(e) => set('startupInstructions')(e.target.value || undefined)}
              placeholder="Custom bootstrap instructions..."
            />
          </div>
        </div>
        </div>
      </div>
    </>
  )
}
