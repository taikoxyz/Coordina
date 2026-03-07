import { GeneralSettings } from './settings/GeneralSettings'
import { useNav } from '../store/nav'
import { DialogShell } from './ui'

export function SettingsDialog() {
  const { isSettingsOpen, setSettingsOpen } = useNav()

  return (
    <DialogShell open={isSettingsOpen} onOpenChange={setSettingsOpen} title="Settings" maxWidth="max-w-lg">
      <GeneralSettings />
    </DialogShell>
  )
}
