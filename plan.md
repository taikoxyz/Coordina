# Code Review Plan

## Objective

Review the whole `coordina` codebase for bugs, regressions, risky assumptions, missing validation, UI/a11y issues, and test gaps, then record prioritized findings in `review_findings.md`.

## Constraints

- The worktree is already dirty. Treat existing user changes as in-progress work and do not revert them.
- This is a review task, not a refactor task. Only create review artifacts unless a blocker forces a smaller supporting change.
- Findings should prioritize correctness, safety, and behavior regressions over style.
- Use relevant skills where they fit cleanly.

## Skill Usage

- `find-skills`: used to discover review-focused skills for this repo.
- Installed and used:
  - `~/.agents/skills/typescript-react-reviewer`
- Installed but rejected for this review:
  - `~/.agents/skills/reviewing-typescript-code`
    - Reason: its checklist is specific to Saleor Configurator conventions and does not map cleanly to this Electron app.
- In progress:
  - `anyproto/anytype-ts@typescript-code-review`
    - Use if installation finishes in time and the guidance is generic enough to apply.

## Review Inputs

- Product and behavior source: `PRODUCT.md`
- Repo structure and scripts: `README.md`, `package.json`
- Type and lint surface: `tsconfig*.json`, `eslint.config.mjs`, `vitest.config.ts`
- UI reference requested by user:
  - `https://component.gallery/`
  - Use as a renderer review reference for navigation, tree/file browser, tabs, and settings-panel interaction patterns.

## Review Streams

### 1. Baseline and Safety Checks

- Inspect current worktree and note heavily edited files to focus on regression risk.
- Run available automated checks:
  - `npm run typecheck`
  - `npm run test`
  - `npm run lint`
- Treat failures as signals, not definitive findings, until tied to code-level behavior.

### 2. Main Process Review

Scope:

- `src/main/server.ts`
- `src/main/index.ts`
- `src/main/watcher.ts`
- `src/main/ipc/**`
- `src/main/gateway/**`
- `src/main/providers/**`
- `src/main/environments/**`
- `src/main/github/**`
- `src/main/store/**`
- `src/main/validation/**`
- `src/preload/**`
- `src/shared/**`

Focus:

- IPC trust boundaries, path handling, and filesystem safety
- Deployment/auth flows and environment assumptions
- Error propagation and user-visible failure modes
- Data persistence integrity
- Test coverage holes around high-risk branches

### 3. Renderer Architecture Review

Scope:

- `src/renderer/src/App.tsx`
- `src/renderer/src/pages/**`
- `src/renderer/src/store/**`
- `src/renderer/src/hooks/**`

Focus:

- Route/page state consistency
- React 19 hook usage
- stale state/effect bugs
- query usage and loading/error state handling
- renderer/main contract mismatches

### 4. Renderer Feature Review

Scope:

- `src/renderer/src/components/chat/**`
- `src/renderer/src/components/files/**`
- `src/renderer/src/components/forms/**`
- `src/renderer/src/components/settings/**`
- `src/renderer/src/components/spec/**`
- `src/renderer/src/components/specs/**`
- `src/renderer/src/components/team/**`
- `src/renderer/src/components/Sidebar.tsx`

Focus:

- Accessibility and keyboard support
- list keys, selection state, and tab/file browser correctness
- component complexity and state locality
- empty/loading/error states
- UI behavior against the product spec
- UI structure quality using `component.gallery` as a reference point for sidebars, trees, and tabbed panels

### 5. Tests and Gaps Review

Scope:

- `src/**/*.test.{ts,tsx}`

Focus:

- Whether tests cover risky behavior in edited code
- missing tests for auth/deploy/file-browser/spec-view flows
- whether tests assert behavior or only implementation details

## Parallel Execution Plan

Run these tracks in parallel where possible:

1. Automated checks
2. Main-process and shared-code inspection
3. Renderer architecture and UI inspection
4. Test inventory and gap analysis

Within each track:

- Prefer `rg`, targeted file reads, and focused test execution over broad dumps.
- Use the React review skill checklist for renderer code.
- Use product spec expectations to verify behavior claims.

## Finding Standard

Each finding in `review_findings.md` should include:

- Severity: `Critical`, `High`, `Medium`, or `Low`
- File reference with line number
- Clear statement of the bug, risk, or regression
- Why it matters in this product
- Brief supporting evidence
- Suggested fix direction when obvious

## Deliverables

- `plan.md`: this plan
- `review_findings.md`: prioritized review results with findings first, then open questions and residual risks if needed
