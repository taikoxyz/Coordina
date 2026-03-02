import React from 'react'

interface SchemaProperty {
  type: string
  title?: string
  description?: string
  enum?: string[]
  format?: string
  default?: unknown
}

interface JsonSchema {
  type: string
  properties?: Record<string, SchemaProperty>
  required?: string[]
}

interface SchemaFormProps {
  schema: JsonSchema
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
}

export function SchemaForm({ schema, value, onChange }: SchemaFormProps) {
  const properties = schema.properties ?? {}
  const required = schema.required ?? []

  function handleChange(key: string, newVal: unknown) {
    onChange({ ...value, [key]: newVal })
  }

  return (
    <div className="space-y-4">
      {Object.entries(properties).map(([key, prop]) => {
        const id = `field-${key}`
        const isRequired = required.includes(key)
        const label = prop.title ?? key

        if (prop.type === 'boolean') {
          return (
            <div key={key} className="flex items-center gap-2">
              <input
                id={id}
                type="checkbox"
                checked={Boolean(value[key])}
                onChange={e => handleChange(key, e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-700"
              />
              <label htmlFor={id} className="text-sm text-gray-300">
                {label}
                {isRequired && <span className="text-red-400 ml-1">*</span>}
              </label>
            </div>
          )
        }

        if (prop.enum) {
          return (
            <div key={key}>
              <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">
                {label}
                {isRequired && <span className="text-red-400 ml-1">*</span>}
              </label>
              <select
                id={id}
                value={String(value[key] ?? prop.default ?? prop.enum[0])}
                onChange={e => handleChange(key, e.target.value)}
                className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {prop.enum.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {prop.description && <p className="text-xs text-gray-500 mt-1">{prop.description}</p>}
            </div>
          )
        }

        const inputType = prop.format === 'password' ? 'password' : 'text'

        return (
          <div key={key}>
            <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">
              {label}
              {isRequired && <span className="text-red-400 ml-1">*</span>}
            </label>
            <input
              id={id}
              type={inputType}
              value={String(value[key] ?? '')}
              onChange={e => handleChange(key, e.target.value)}
              placeholder={prop.description}
              className="w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
            />
            {prop.description && inputType !== 'password' && (
              <p className="text-xs text-gray-500 mt-1">{prop.description}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
