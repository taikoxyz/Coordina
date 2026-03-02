import React, { useState, useEffect } from 'react'
import { SchemaForm } from '../forms/SchemaForm'
import type { ProviderRecord } from '../../hooks/useProviders'

const PROVIDER_TYPES = [
  { id: 'anthropic', displayName: 'Anthropic' },
  { id: 'openai', displayName: 'OpenAI' },
  { id: 'deepseek', displayName: 'DeepSeek' },
  { id: 'ollama', displayName: 'Ollama (local)' },
  { id: 'openrouter', displayName: 'OpenRouter' },
]

// Config schemas mirrored from main providers — used for rendering the form
const PROVIDER_SCHEMAS: Record<string, object> = {
  anthropic: {
    type: 'object',
    required: ['apiKey', 'model'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', description: 'Your Anthropic API key (sk-ant-...)', format: 'password' },
      model: { type: 'string', title: 'Model', enum: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'], default: 'claude-sonnet-4-6' },
    },
  },
  openai: {
    type: 'object',
    required: ['apiKey', 'model'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', description: 'Your OpenAI API key (sk-...)', format: 'password' },
      model: { type: 'string', title: 'Model', enum: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini'], default: 'gpt-4o' },
    },
  },
  deepseek: {
    type: 'object',
    required: ['apiKey', 'model'],
    properties: {
      apiKey: { type: 'string', title: 'API Key', format: 'password' },
      model: { type: 'string', title: 'Model', enum: ['deepseek-chat', 'deepseek-reasoner'], default: 'deepseek-chat' },
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

  useEffect(() => {
    if (!provider) setConfig({})
  }, [type])

  const schema = PROVIDER_SCHEMAS[type] ?? { type: 'object', properties: {} }

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
