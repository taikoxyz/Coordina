// IPC handler registrations — imported in src/main/index.ts
// Each module registers its own handlers via ipcMain.handle()

import { registerProviderHandlers } from './providers'
import { registerSettingsHandlers } from './settings'
import { registerEnhanceHandlers } from './enhance'
import { registerTeamHandlers } from './teams'
import { registerDeployHandlers } from './deploy'
import { registerFileHandlers } from './files'
import { registerModelsHandlers } from './models'
import { registerGitHandlers } from './git'
import { registerChatHandlers } from './chat'
import { registerProjectHandlers } from './projects'

registerProviderHandlers()
registerSettingsHandlers()
registerEnhanceHandlers()
registerTeamHandlers()
registerDeployHandlers()
registerFileHandlers()
registerModelsHandlers()
registerGitHandlers()
registerChatHandlers()
registerProjectHandlers()
