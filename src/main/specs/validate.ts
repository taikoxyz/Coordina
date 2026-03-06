import yaml from 'js-yaml'
import type { SpecFile, ValidationError, ValidationResult } from '../../shared/types'

function pushError(errors: ValidationError[], field: string, message: string): void {
  errors.push({ field, message })
}

export function validateDerivedSpecFiles(files: SpecFile[]): ValidationResult {
  const errors: ValidationError[] = []
  const seenPaths = new Set<string>()

  if (files.length === 0) {
    pushError(errors, 'deploy', 'No deployment files were derived')
    return { valid: false, errors }
  }

  for (const file of files) {
    if (!file.path.trim()) {
      pushError(errors, 'deploy', 'Derived file is missing a path')
      continue
    }

    if (seenPaths.has(file.path)) {
      pushError(errors, file.path, 'Duplicate derived file path')
      continue
    }
    seenPaths.add(file.path)

    if (!file.content.trim()) {
      pushError(errors, file.path, 'Derived file is empty')
      continue
    }

    if (file.path.endsWith('.yaml') || file.path.endsWith('.yml')) {
      try {
        const docs = yaml.loadAll(file.content)
        if (docs.length === 0) {
          pushError(errors, file.path, 'YAML file does not contain any documents')
          continue
        }

        docs.forEach((doc, index) => {
          if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
            pushError(errors, file.path, `Document ${index + 1} is not a Kubernetes object`)
            return
          }

          const manifest = doc as {
            apiVersion?: unknown
            kind?: unknown
            metadata?: { name?: unknown }
          }

          if (typeof manifest.apiVersion !== 'string' || manifest.apiVersion.trim().length === 0) {
            pushError(errors, file.path, `Document ${index + 1} is missing apiVersion`)
          }
          if (typeof manifest.kind !== 'string' || manifest.kind.trim().length === 0) {
            pushError(errors, file.path, `Document ${index + 1} is missing kind`)
          }
          if (typeof manifest.metadata?.name !== 'string' || manifest.metadata.name.trim().length === 0) {
            pushError(errors, file.path, `Document ${index + 1} is missing metadata.name`)
          }
        })
      } catch (error) {
        pushError(errors, file.path, error instanceof Error ? error.message : String(error))
      }
      continue
    }

    if (file.path.endsWith('.json')) {
      try {
        JSON.parse(file.content)
      } catch (error) {
        pushError(errors, file.path, error instanceof Error ? error.message : String(error))
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
