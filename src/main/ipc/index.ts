// IPC handler registrations — imported in src/main/index.ts
// Each module registers its own handlers via ipcMain.handle()

import { registerProviderHandlers } from './providers'
import { registerSettingsHandlers } from './settings'
import { registerEnhanceHandlers } from './enhance'
import { registerTeamHandlers } from './teams'
import { registerAgentHandlers } from './agents'
import { registerDeployHandlers } from './deploy'
import { registerFileHandlers } from './files'

registerProviderHandlers()
registerSettingsHandlers()
registerEnhanceHandlers()
registerTeamHandlers()
registerAgentHandlers()
registerDeployHandlers()
registerFileHandlers()
