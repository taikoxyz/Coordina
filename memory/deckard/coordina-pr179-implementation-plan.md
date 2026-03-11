# Issue #179: Language Constraint Enforcement Implementation Plan

## Summary
Add configuration option to enforce agent responses in English and Simplified Chinese only, blocking or auto-translating other languages.

---

## Current State Analysis

### Where Language Could Be Configured

| Location | Purpose | Pros | Cons |
|----------|---------|------|------|
| `AgentSpec` (types.ts) | Team-level agent config | Centralized, validated | Coordina-only |
| `openclaw.json` | Agent runtime config | Direct agent control | Per-agent config needed |
| `SOUL.md` | Agent directive | Flexible, human-readable | No enforcement mechanism |
| Gateway middleware | Runtime interception | Works for all agents | Complex to implement |

### Relevant Files in Coordina

- `src/shared/types.ts` — `AgentSpec` interface (line 14-34)
- `src/shared/validateTeamSpec.ts` — Validation logic
- `src/shared/derivationDefaults.ts` — Default injected content
- `openclaw.json` — OpenClaw runtime config

---

## Proposed Implementation

### 1. Add Language Config to AgentSpec

**File:** `src/shared/types.ts`

```typescript
export interface AgentSpec {
  // ... existing fields
  languages?: {
    allowed: string[]        // e.g., ["en", "zh-CN"]
    default?: string          // e.g., "en"
    enforcement: "allow" | "block" | "translate"
    translateTo?: string      // if enforcement is "translate"
  }
}
```

### 2. Add Validation

**File:** `src/shared/validateTeamSpec.ts`

```typescript
// Add validation for language config
const SUPPORTED_LANGUAGES = ["en", "zh-CN", "zh-TW", "ja", "ko", "es", "fr", "de"]

if (agent.languages) {
  for (const lang of agent.languages.allowed) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      errors.push({ 
        field: `${prefix}.languages.allowed`, 
        message: `Unsupported language: ${lang}` 
      })
    }
  }
  if (agent.languages.enforcement === "translate" && !agent.languages.translateTo) {
    errors.push({ 
      field: `${prefix}.languages.translateTo`, 
      message: "translateTo is required when enforcement is translate" 
    })
  }
}
```

### 3. Add Derivation Defaults

**File:** `src/shared/derivationDefaults.ts`

```typescript
export const DEFAULT_LANGUAGE_RULES = [
  "Respond only in the configured languages (English or Simplified Chinese).",
  "If a response requires a language not in the allowed list, use the default language.",
]

export const DEFAULT_PATTERNS: Required<DerivationPatterns> = {
  // ... existing
  agents: {
    // ... existing fields
    languageRules: DEFAULT_LANGUAGE_RULES,
  },
}
```

### 4. Add UI Support (Optional)

**File:** `@renderer/src/components/agent-form.tsx`

- Add language configuration section in agent editor
- Multi-select for allowed languages
- Dropdown for enforcement mode

---

## Alternative: OpenClaw Runtime Config

For direct agent-level enforcement without Coordina:

**File:** `openclaw.json`

```json5
{
  agents: {
    defaults: {
      languagePolicy: {
        allowed: ["en", "zh-CN"],
        default: "en",
        enforcement: "block"  // block | warn | translate
      }
    }
  }
}
```

### Implementation Approach (Gateway-Level)

1. Add language detection middleware in Gateway
2. Use `franc-min` or similar for language detection
3. Block/warn/translate based on config

---

## Recommended Approach

### Phase 1: Coordina Integration (MVP)
1. Add `languages` field to `AgentSpec` type
2. Add validation rules
3. Inject language rules into derived `AGENTS.md`
4. Document the feature

### Phase 2: Runtime Enforcement (Future)
1. Add language policy to OpenClaw config schema
2. Implement detection middleware
3. Add translation integration (optional)

---

## Files to Modify

| File | Change Type |
|------|-------------|
| `src/shared/types.ts` | Add `languages` to `AgentSpec` |
| `src/shared/validateTeamSpec.ts` | Add validation |
| `src/shared/derivationDefaults.ts` | Add default rules |
| `src/main/github/spec.ts` | Include in generated AGENTS.md |
| `@renderer/src/lib/agentSpecForm.tsx` | Add UI (if needed) |

---

## Testing Strategy

1. **Unit Tests:** Validate language config parsing
2. **Integration Test:** Deploy team with language config
3. **Manual Test:** Verify agent responds in allowed languages only

---

## Open Questions

1. **Translation Service:** Should we integrate auto-translation? (Complex, requires API)
2. **Per-Channel Override:** Allow different languages per Telegram/Discord?
3. **Fallback Behavior:** What if detection fails?

---

*Research completed: 2026-03-11*
*Agent: Deckard*
