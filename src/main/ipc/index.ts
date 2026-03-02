// IPC handler registrations — imported in src/main/index.ts
// Each module registers its own handlers via ipcMain.handle()

import { registerProviderHandlers } from './providers'
import { registerSettingsHandlers } from './settings'
import { registerEnhanceHandlers } from './enhance'

registerProviderHandlers()
registerSettingsHandlers()
registerEnhanceHandlers()
