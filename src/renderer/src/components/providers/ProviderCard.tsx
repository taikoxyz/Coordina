import type { ProviderRecord } from '../../hooks/useProviders'

interface ProviderCardProps {
  provider: ProviderRecord
  onEdit: () => void
  onDelete: () => void
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  ollama: 'Ollama',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  mistral: 'Mistral',
  xai: 'xAI',
  google: 'Google',
  together: 'Together AI',
  'openai-compatible': 'Custom',
}

export function ProviderCard({ provider, onEdit, onDelete }: ProviderCardProps) {
  const model = provider.config.model as string | undefined
  const baseUrl = provider.config.baseUrl as string | undefined

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-900 text-blue-300">
            {PROVIDER_LABELS[provider.type] ?? provider.type}
          </span>
          <h3 className="font-medium text-gray-100 truncate">{provider.name}</h3>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400">
          {model && (
            <span><span className="text-gray-500">model</span> {model}</span>
          )}
          {baseUrl && (
            <span className="truncate max-w-xs"><span className="text-gray-500">url</span> {baseUrl}</span>
          )}
          {provider.maskedApiKey && (
            <span><span className="text-gray-500">key</span> <span className="font-mono">{provider.maskedApiKey}</span></span>
          )}
          {!provider.maskedApiKey && provider.type !== 'ollama' && provider.type !== 'openai-compatible' && (
            <span className="text-yellow-600">no API key stored</span>
          )}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onEdit}
          className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => {
            if (window.confirm(`Delete provider "${provider.name}"? This cannot be undone.`))
              onDelete()
          }}
          className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-red-900 text-gray-200 hover:text-red-300 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
