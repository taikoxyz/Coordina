import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { GeneralSettings } from './settings/GeneralSettings'
import { useNav } from '../store/nav'

export function SettingsDialog() {
  const { isSettingsOpen, setSettingsOpen } = useNav()

  return (
    <Dialog.Root open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-lg focus:outline-none data-[state=open]:animate-fade-in">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-[var(--color-foreground)]">
              Settings
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <GeneralSettings />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
