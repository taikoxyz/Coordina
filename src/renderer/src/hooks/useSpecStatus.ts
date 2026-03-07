// Hook for listening to auto-validation and derivation pipeline events
// FEATURE: Spec status hook subscribing to spec:validation and spec:derivation IPC events
import { useState, useEffect } from 'react'
import type { ValidationError } from '../../../shared/types'

export type DerivationStatus = 'idle' | 'running' | 'success' | 'error'

export interface SpecStatus {
  validationErrors: ValidationError[]
  derivationStatus: DerivationStatus
  derivationError?: string
  isValid: boolean
  isReady: boolean
}

export const useSpecStatus = (teamSlug: string): SpecStatus => {
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [isValid, setIsValid] = useState(false)
  const [derivationStatus, setDerivationStatus] = useState<DerivationStatus>('idle')
  const [derivationError, setDerivationError] = useState<string | undefined>()

  useEffect(() => {
    if (!teamSlug) return

    void window.api.invoke('teams:validate', teamSlug)

    const removeValidation = window.api.on('spec:validation', (...args: unknown[]) => {
      const data = args[0] as { teamSlug: string; valid: boolean; errors: ValidationError[] }
      if (data.teamSlug !== teamSlug) return
      setValidationErrors(data.errors ?? [])
      setIsValid(data.valid)
    })

    const removeDerivation = window.api.on('spec:derivation', (...args: unknown[]) => {
      const data = args[0] as { teamSlug: string; status: DerivationStatus; error?: string }
      if (data.teamSlug !== teamSlug) return
      setDerivationStatus(data.status)
      setDerivationError(data.error)
    })

    return () => {
      removeValidation?.()
      removeDerivation?.()
    }
  }, [teamSlug])

  return {
    validationErrors,
    derivationStatus,
    derivationError,
    isValid,
    isReady: isValid && derivationStatus === 'success',
  }
}
