import { describe, expect, it } from 'vitest'
import { validateDerivedSpecFiles } from './validate'

describe('validateDerivedSpecFiles', () => {
  it('accepts well-formed Kubernetes manifests', () => {
    const result = validateDerivedSpecFiles([
      {
        path: 'namespace.yaml',
        content: `
apiVersion: v1
kind: Namespace
metadata:
  name: my-team
`,
      },
      {
        path: 'agents/alpha/config.json',
        content: '{"agents":{"defaults":{"workspace":"/tmp"}}}',
      },
    ])

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects malformed yaml content', () => {
    const result = validateDerivedSpecFiles([
      {
        path: 'broken.yaml',
        content: 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: broken\n  labels: [',
      },
    ])

    expect(result.valid).toBe(false)
    expect(result.errors[0]?.field).toBe('broken.yaml')
  })

  it('rejects manifests missing required kubernetes fields', () => {
    const result = validateDerivedSpecFiles([
      {
        path: 'configmap.yaml',
        content: `
apiVersion: v1
metadata:
  name: shared
`,
      },
    ])

    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual({
      field: 'configmap.yaml',
      message: 'Document 1 is missing kind',
    })
  })
})
