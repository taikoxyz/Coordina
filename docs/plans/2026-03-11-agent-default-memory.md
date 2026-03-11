# Agent Default Memory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set the default Kubernetes memory request/limit for agent pods to `2.5Gi`.

**Architecture:** Update the GKE StatefulSet manifest generator so every agent pod gets an explicit default memory request and limit. Cover the change with a focused manifest test so the default stays stable.

**Tech Stack:** TypeScript, YAML manifest generation, Vitest

---

### Task 1: Add failing manifest test

**Files:**

- Modify: `src/main/environments/gke/manifests.test.ts`

**Step 1: Write the failing test**

Add a test asserting the generated agent StatefulSet includes:

- `requests.memory: 2.5Gi`
- `limits.memory: 2.5Gi`

**Step 2: Run test to verify it fails**

Run: `npm test -- src/main/environments/gke/manifests.test.ts`

Expected: FAIL because the manifest currently only sets CPU resources.

**Step 3: Write minimal implementation**

Update the StatefulSet generator to emit default memory request/limit of `2.5Gi`.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/main/environments/gke/manifests.test.ts`

Expected: PASS

### Task 2: Verify focused output

**Files:**

- Modify: `src/main/environments/gke/manifests.ts`

**Step 1: Run focused lint or formatting check**

Run:

```bash
npx eslint src/main/environments/gke/manifests.ts src/main/environments/gke/manifests.test.ts
```

Expected: PASS

**Step 2: Commit**

```bash
git add docs/plans/2026-03-11-agent-default-memory.md src/main/environments/gke/manifests.ts src/main/environments/gke/manifests.test.ts
git commit -m "feat: raise default agent memory to 2.5Gi"
```
