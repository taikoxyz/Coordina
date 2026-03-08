import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useProviders, useDeleteProvider } from '../hooks/useProviders'
import { useNav } from '../store/nav'
import { Button, Card, CardContent, ReadField } from './ui'

const PROVIDER_NAMES: Record<string, string> = {
  claude: 'Claude', anthropic: 'Anthropic', openai: 'OpenAI', deepseek: 'DeepSeek', openrouter: 'OpenRouter', minimax: 'MiniMax', ollama: 'Ollama',
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

        <Card>
          <CardContent>
            <ReadField label="Model" value={provider.model} monospace />
            {provider.maskedApiKey && (
              <ReadField label="API Key" value={provider.maskedApiKey} monospace />
            )}
            <ReadField label="Type" value={PROVIDER_NAMES[provider.type] ?? provider.type} />
          </CardContent>
        </Card>

        <div className="pt-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <Button variant="destructive" onClick={handleDelete}>
                Confirm delete
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="ghost-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-3.5 h-3.5" />
              Delete provider
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
