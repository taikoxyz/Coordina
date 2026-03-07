import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useProviders, useDeleteProvider } from '../hooks/useProviders'
import { useNav } from '../store/nav'

const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Anthropic', openai: 'OpenAI', deepseek: 'DeepSeek', openrouter: 'OpenRouter', ollama: 'Ollama',
}

export function ProviderDetail({ slug }: { slug: string }) {
  const { data: providers } = useProviders()
  const deleteProvider = useDeleteProvider()
  const { selectItem } = useNav()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const provider = providers?.find((p) => p.slug === slug)
  if (!provider) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Provider not found
      </div>
    )
  }

  const handleDelete = () => {
    deleteProvider.mutate(slug)
    selectItem(null as never)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 text-sm font-semibold text-gray-600 uppercase">
            {provider.type.slice(0, 2)}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {PROVIDER_NAMES[provider.type] ?? provider.type}
            </h2>
            <p className="text-xs text-gray-400 font-mono">{provider.slug}</p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Model</label>
            <p className="text-sm text-gray-900 font-mono">{provider.model}</p>
          </div>
          {provider.maskedApiKey && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
              <p className="text-sm text-gray-400 font-mono">{provider.maskedApiKey}</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <p className="text-sm text-gray-900">{PROVIDER_NAMES[provider.type] ?? provider.type}</p>
          </div>
        </div>

        <div className="pt-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Confirm delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete provider
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
