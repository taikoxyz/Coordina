# Telegram Deploy Guard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Block deploy only when Telegram is partially configured, while keeping non-Telegram teams deployable.

**Architecture:** Add a single backend validation rule that treats Telegram as optional but complete-or-disabled, then surface the same result in the Deploy tab so users see the reason before clicking deploy. Reuse one shared helper for the Telegram readiness check so UI and backend do not drift.

**Tech Stack:** Electron, React, TypeScript, Vitest, keytar-backed secret storage

---

### Task 1: Add backend Telegram deploy validation

**Files:**

- Modify: `src/main/validation/teamSpec.ts`
- Test: `src/main/ipc/teams.validation.test.ts` or a new focused validation test

**Step 1: Write the failing test**

Add a test that a team with Telegram group/admin IDs and an agent bot ID, but no saved token readiness, is rejected for deploy validation.

**Step 2: Run test to verify it fails**

Run: `npm test -- <targeted validation test file>`

Expected: FAIL because current validation only checks basic name/slug/model requirements.

**Step 3: Write minimal implementation**

Add a validation helper that:

- allows no Telegram usage
- errors when only one of `telegramGroupId` / `telegramAdminId` is set
- errors when Telegram is in use for an agent but that agent is missing `telegramBot`
- leaves token existence to deploy-time readiness validation if token lookup is async

**Step 4: Run test to verify it passes**

Run: `npm test -- <targeted validation test file>`

Expected: PASS

### Task 2: Add deploy-time Telegram token readiness check

**Files:**

- Modify: `src/main/ipc/deploy.ts`
- Create or modify: small helper under `src/main/ipc/` or `src/main/validation/`
- Test: new focused test for deploy readiness helper

**Step 1: Write the failing test**

Add a test that team deploy preview/deploy is rejected when Telegram is partially configured and the required agent token is missing from keychain.

**Step 2: Run test to verify it fails**

Run: `npm test -- <new focused test file>`

Expected: FAIL because deploy currently proceeds to spec derivation without a Telegram completeness guard.

**Step 3: Write minimal implementation**

Create a helper that:

- reads the current team spec
- determines whether Telegram is in use for the current deploy scope
- checks keychain token presence for each affected agent
- returns `{ ok: true }` or `{ ok: false, reason }`

Call it from deploy preview and deploy execution before file derivation.

**Step 4: Run test to verify it passes**

Run: `npm test -- <new focused test file>`

Expected: PASS

### Task 3: Surface the guard in the Deploy tab

**Files:**

- Modify: `src/renderer/src/components/DeployPanel.tsx`
- Modify if needed: `src/renderer/src/hooks/useTeams.ts` or related hooks
- Test: renderer helper test or component test

**Step 1: Write the failing test**

Add a test for the derived deploy-disabled reason when Telegram is partially configured for the selected team/agent.

**Step 2: Run test to verify it fails**

Run: `npm test -- <targeted renderer test file>`

Expected: FAIL because deploy buttons are currently disabled only for missing GKE config or active deployment.

**Step 3: Write minimal implementation**

Compute a Telegram-specific disabled reason in the Deploy panel and merge it with existing button disable logic.

Show the reason inline near the deploy controls.

**Step 4: Run test to verify it passes**

Run: `npm test -- <targeted renderer test file>`

Expected: PASS

### Task 4: Verify focused behavior

**Files:**

- No additional files required

**Step 1: Run focused tests**

Run:

```bash
npm test -- src/main/ipc/files.test.ts src/main/telegram.test.ts <new validation/deploy tests> <new renderer test>
```

Expected: PASS

**Step 2: Run focused lint**

Run:

```bash
npx eslint src/main/validation/teamSpec.ts src/main/ipc/deploy.ts src/renderer/src/components/DeployPanel.tsx <new test files>
```

Expected: PASS or formatting-only warnings fixed immediately.

**Step 3: Commit**

```bash
git add docs/plans/2026-03-10-telegram-deploy-guard-design.md docs/plans/2026-03-10-telegram-deploy-guard.md src/main/validation/teamSpec.ts src/main/ipc/deploy.ts src/renderer/src/components/DeployPanel.tsx
git commit -m "feat: guard deploys for incomplete telegram setup"
```
