import { useSpecStatus } from '../../hooks/useSpecStatus'
import { useNav } from '../../store/nav'
import { ChevronRight, Check, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TeamSpec } from '../../../../shared/types'

interface Props {
  spec: TeamSpec
  showSaveButton?: boolean
  onSave?: () => void | Promise<void>
  isSaving?: boolean
}

export function TeamToolbar({ spec, showSaveButton = true, onSave, isSaving = false }: Props) {
  const { setPage } = useNav()
  const status = useSpecStatus(spec.slug)

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

        {showSaveButton && (
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>
    </div>
  )
}
