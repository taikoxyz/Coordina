# SQLite Removal + Chat Attachments Execution Plan

**Goal:** remove SQLite entirely from Coordina and support sending file attachments with text in chat.

## Scope

1. Replace all remaining SQLite runtime dependencies with file-based stores under `~/.coordina`.
2. Keep gateway proxy, deploy metadata, and file browser behavior working without DB lookups.
3. Add chat composer support for text + file attachments through OpenClaw-compatible request payloads.
4. Update tests/docs that still reference SQLite.
5. Run verification commands and fix issues found during execution.

## Tasks

- [x] Add file-based data-dir and deployment metadata store.
- [x] Rewire gateway proxy and file IPC handlers off SQLite.
- [x] Persist deployment metadata on deploy/undeploy.
- [x] Remove `better-sqlite3` dependencies and delete SQLite module.
- [x] Update docs that mention local SQLite usage.
- [x] Add attachment flow in renderer chat hook and UI.
- [x] Resolve Node typecheck failures in tests.
- [x] Run verification (`typecheck:web`, `typecheck:node`, targeted tests where environment allows).

## Verification

- `npm run typecheck:web` should pass.
- `npm run typecheck:node` should pass after test fixes.
- If Vitest cannot run in this environment, document the exact tooling blocker and files impacted.

## Execution Notes

- `npm run typecheck` passes (both node and web).
- Attachment payload now conforms to OpenClaw OpenResponses schema:
  - `input` item includes `type: "message"` and `role: "user"`
  - files/images are sent with `source: { type: "base64", media_type, data, filename? }`
- `npm run test -- ...` is currently blocked by a local Vitest/Vite ESM startup error:
  `ERR_REQUIRE_ESM` loading `vite/dist/node/index.js` from `vitest/dist/config.cjs`.
