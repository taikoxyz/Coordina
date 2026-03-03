import { useState, useEffect } from 'react'
import { SchemaForm } from '../forms/SchemaForm'
import type { ProviderRecord } from '../../hooks/useProviders'

const PROVIDER_TYPES = [
  { id: 'anthropic', displayName: 'Anthropic' },
  { id: 'openai', displayName: 'OpenAI' },
  { id: 'deepseek', displayName: 'DeepSeek' },
  { id: 'ollama', displayName: 'Ollama (local)' },
  { id: 'openrouter', displayName: 'OpenRouter' },
  { id: 'groq', displayName: 'Groq' },
  { id: 'mistral', displayName: 'Mistral' },
  { id: 'xai', displayName: 'xAI (Grok)' },
  { id: 'google', displayName: 'Google Gemini' },
  { id: 'together', displayName: 'Together AI' },
  { id: 'openai-compatible', displayName: 'OpenAI-Compatible (custom)' },
]

// Config schemas mirrored from main providers — used for rendering the form
const PROVIDER_SCHEMAS: Record<string, object> = {
  anthropic: {
    type: 'object',
    required: ['apiKey', 'model'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', description: 'Your Anthropic API key (sk-ant-...)', format: 'password' },
      model: { type: 'string', title: 'Model', description: 'e.g. claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001', default: 'claude-sonnet-4-6' },
    },
  },
  openai: {
    type: 'object',
    required: ['apiKey', 'model'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', description: 'Your OpenAI API key (sk-...)', format: 'password' },
      model: { type: 'string', title: 'Model', description: 'e.g. gpt-4o, gpt-4.1, o3, o4-mini', default: 'gpt-4o' },
    },
  },
  deepseek: {
    type: 'object',
    required: ['apiKey', 'model'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', format: 'password' },
      model: { type: 'string', title: 'Model', description: 'e.g. deepseek-chat, deepseek-reasoner', default: 'deepseek-chat' },
    },
  },
  ollama: {
    type: 'object',
    required: ['baseUrl', 'model'],
    properties: {
      baseUrl: { type: 'string', title: 'Base URL', description: 'e.g. http://localhost:11434', default: 'http://localhost:11434' },
      model: { type: 'string', title: 'Model', description: 'e.g. llama3, mistral', default: 'llama3' },
    },
  },
  openrouter: {
    type: 'object',
    required: ['apiKey', 'model'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', description: 'Your OpenRouter API key (sk-or-...)', format: 'password' },
      model: { type: 'string', title: 'Model', description: 'e.g. openai/gpt-4o', default: 'openai/gpt-4o' },
    },
  },
  groq: {
    type: 'object',
    required: ['apiKey'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', format: 'password' },
      model: { type: 'string', title: 'Model (optional)', description: 'Leave blank to pick in agent form' },
    },
  },
  mistral: {
    type: 'object',
    required: ['apiKey'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', format: 'password' },
      model: { type: 'string', title: 'Model (optional)' },
    },
  },
  xai: {
    type: 'object',
    required: ['apiKey'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', format: 'password' },
      model: { type: 'string', title: 'Model (optional)' },
    },
  },
  google: {
    type: 'object',
    required: ['apiKey'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', description: 'Google AI Studio API key', format: 'password' },
      model: { type: 'string', title: 'Model (optional)' },
    },
  },
  together: {
    type: 'object',
    required: ['apiKey'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', format: 'password' },
      model: { type: 'string', title: 'Model (optional)' },
    },
  },
  'openai-compatible': {
    type: 'object',
    required: ['baseUrl'],
    properties: {
      baseUrl: { type: 'string', title: 'Base URL', description: 'e.g. http://localhost:11434/v1' },
      apiKey: { type: 'string', title: 'API Key (optional)', format: 'password' },
      model: { type: 'string', title: 'Model', description: 'Required for custom endpoints' },
    },
  },
}

interface ProviderModalProps {
  provider?: ProviderRecord
  onSave: (data: { type: string; name: string; config: Record<string, unknown> }) => void
  onClose: () => void
  errors?: string[]
}

export function ProviderModal({ provider, onSave, onClose, errors }: ProviderModalProps) {
  const [type, setType] = useState(provider?.type ?? 'anthropic')
  const [name, setName] = useState(provider?.name ?? '')
  const [config, setConfig] = useState<Record<string, unknown>>(provider?.config ?? {})

  const schema = PROVIDER_SCHEMAS[type] ?? { type: 'object', properties: {} }

  useEffect(() => {
    if (!provider) {
      // Pre-populate config with schema defaults so fields like `model` are saved even if untouched
      const defaults: Record<string, unknown> = {}
      const props = (schema as { properties?: Record<string, { default?: unknown }> }).properties ?? {}
      for (const [key, prop] of Object.entries(props)) {
        if (prop.default !== undefined) defaults[key] = prop.default
      }
      setConfig(defaults)
      setName(PROVIDER_TYPES.find(p => p.id === type)?.displayName ?? '')
    }
  }, [type])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-100 mb-4">
          {provider ? 'Edit Provider' : 'Add Provider'}
        </h2>

        <div className="space-y-4">
          {!provider && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Provider Type <span className="text-red-400">*</span>
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {PROVIDER_TYPES.map(pt => (
                  <option key={pt.id} value={pt.id}>{pt.displayName}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. My Anthropic"
              className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>

          <SchemaForm schema={schema as any} value={config} onChange={setConfig} />
        </div>

        {errors && errors.length > 0 && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded text-sm text-red-300">
            {errors.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ type, name, config })}
            className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            {provider ? 'Save Changes' : 'Add Provider'}
          </button>
        </div>
      </div>
    </div>
  )
}
