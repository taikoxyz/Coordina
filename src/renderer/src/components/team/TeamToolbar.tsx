import { useSpecStatus } from '../../hooks/useSpecStatus'
import { useSaveTeam } from '../../hooks/useTeams'
import { useNav } from '../../store/nav'
import { ChevronRight, Check, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TeamSpec } from '../../../../shared/types'

interface Props {
  spec: TeamSpec
}

export function TeamToolbar({ spec }: Props) {
  const { setPage } = useNav()
  const status = useSpecStatus(spec.slug)
  const saveTeam = useSaveTeam()

  const handleSave = () => saveTeam.mutate(spec)

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm min-w-0">
        <button
          onClick={() => setPage('teams')}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          Teams
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
        <span className="font-medium text-gray-900 truncate">
          {spec.name || spec.slug}
        </span>
      </div>

      {/* Status badges + Save */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Validation badge */}
        <span className={cn(
          'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded',
          status.isValid
            ? 'text-green-700 bg-green-50'
            : status.validationErrors.length
            ? 'text-red-700 bg-red-50'
            : 'text-gray-500 bg-gray-100'
        )}>
          {status.isValid
            ? <><Check className="w-3 h-3" /> Valid</>
            : status.validationErrors.length
            ? <><AlertCircle className="w-3 h-3" /> {status.validationErrors.length} error{status.validationErrors.length !== 1 ? 's' : ''}</>
            : 'Validating...'
          }
        </span>

        {/* Derivation badge */}
        <span className={cn(
          'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded',
          status.derivationStatus === 'success'
            ? 'text-green-700 bg-green-50'
            : status.derivationStatus === 'error'
            ? 'text-red-700 bg-red-50'
            : status.derivationStatus === 'running'
            ? 'text-yellow-700 bg-yellow-50'
            : 'text-gray-500 bg-gray-100'
        )}>
          {status.derivationStatus === 'success' && <><Check className="w-3 h-3" /> Derived</>}
          {status.derivationStatus === 'running' && <><Loader2 className="w-3 h-3 animate-spin" /> Deriving</>}
          {status.derivationStatus === 'error' && <><AlertCircle className="w-3 h-3" /> Derive failed</>}
          {status.derivationStatus === 'idle' && '—'}
        </span>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saveTeam.isPending}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saveTeam.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
