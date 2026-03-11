# Telegram Deploy Guard Design

## Goal

Prevent users from deploying a team or agent when Telegram is partially configured, while still allowing normal deploys for teams that do not use Telegram at all.

## Problem

Coordina currently allows deployment when the Telegram setup is incomplete. In practice that creates a misleading state:

- the UI shows Telegram bot metadata and token saved locally
- the user can deploy successfully
- the running pod may still have no `TELEGRAM_BOT_TOKEN` and no `channels.telegram` config

This happens because Telegram activation requires a complete set of fields at deploy time, but the current deploy UI does not explain or enforce that requirement.

## Approved Approach

Use option 1:

- Only block deploy when Telegram is partially configured.
- Do not block deploy for teams with no Telegram setup at all.
- Enforce the rule in both the UI and backend.

## Scope

### Telegram considered "in use"

Telegram should be treated as in use when either:

- the team has `telegramGroupId` or `telegramAdminId`, or
- the deploy target agent has `telegramBot`, or
- any agent in the team has `telegramBot` for team-wide deploys.

### Telegram considered "deploy-ready"

For each affected agent:

- `agent.telegramBot` must be set
- the corresponding keychain token must exist

For team-level routing:

- `spec.telegramGroupId` and `spec.telegramAdminId` must either both be set or both be empty

If Telegram is not in use, deploy remains allowed.

## UX

In the Deploy tab:

- disable `Deploy Team` / `Deploy Agent` when Telegram is partially configured
- show a specific reason such as:
  - `Telegram is partially configured for achilles: missing bot token`
  - `Telegram team routing requires both Group ID and Admin ID`

This should be computed from the current saved spec plus saved token presence, not from the last deployment.

## Backend Enforcement

`deploy:preview` and `deploy:team` should continue to fail safely even if the UI is bypassed. The backend validation should return explicit field-level errors for incomplete Telegram setup.

## Files Likely Affected

- `src/main/validation/teamSpec.ts`
- `src/main/ipc/deploy.ts`
- `src/main/ipc/teams.ts` or a small reusable helper for reading token presence
- `src/renderer/src/components/DeployPanel.tsx`
- tests near the validation and deploy panel logic

## Testing

- backend validation test for partial Telegram setup
- backend validation test for no-Telegram setup still passing
- UI or helper-level test for disabled deploy reason
