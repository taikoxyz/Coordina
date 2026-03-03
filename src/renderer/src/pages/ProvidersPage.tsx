import { useState } from 'react'
import { ProviderCard } from '../components/providers/ProviderCard'
import { ProviderModal } from '../components/providers/ProviderModal'
import { useProviders, useCreateProvider, useUpdateProvider, useDeleteProvider } from '../hooks/useProviders'
import type { ProviderRecord } from '../hooks/useProviders'

export function ProvidersPage() {
  const { data: providers, isLoading } = useProviders()
  const createProvider = useCreateProvider()
  const updateProvider = useUpdateProvider()
  const deleteProvider = useDeleteProvider()

  const [showModal, setShowModal] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ProviderRecord | undefined>()
  const [formErrors, setFormErrors] = useState<string[]>([])

  async function handleSave(data: { type: string; name: string; config: Record<string, unknown> }) {
    setFormErrors([])
    if (editingProvider) {
      const result = await updateProvider.mutateAsync({ id: editingProvider.id, data: { name: data.name, config: data.config } })
      if (!result.ok) { setFormErrors(result.errors ?? ['Save failed']); return }
    } else {
      const result = await createProvider.mutateAsync(data)
      if (!result.ok) { setFormErrors(result.errors ?? ['Create failed']); return }
    }
    setShowModal(false)
    setEditingProvider(undefined)
  }

  function handleEdit(provider: ProviderRecord) {
    setEditingProvider(provider)
    setFormErrors([])
    setShowModal(true)
  }

  function handleClose() {
    setShowModal(false)
    setEditingProvider(undefined)
    setFormErrors([])
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Model Providers</h1>
          <p className="text-sm text-gray-400 mt-1">Configure AI model providers for your agents.</p>
        </div>
        <button
          onClick={() => { setEditingProvider(undefined); setFormErrors([]); setShowModal(true) }}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          + Add Provider
        </button>
      </div>

      {isLoading && <p className="text-gray-500 text-sm">Loading...</p>}

      {!isLoading && (!providers || providers.length === 0) && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No providers configured</p>
          <p className="text-sm">Add a model provider to get started.</p>
        </div>
      )}

      {providers && providers.length > 0 && (
        <div className="space-y-3">
          {providers.map(p => (
            <ProviderCard
              key={p.id}
              provider={p}
              onEdit={() => handleEdit(p)}
              onDelete={() => deleteProvider.mutate(p.id)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <ProviderModal
          provider={editingProvider}
          onSave={handleSave}
          onClose={handleClose}
          errors={formErrors}
        />
      )}
    </div>
  )
}
