# D Squad GitHub Workflow

> **Effective:** 2026-03-11  
> **Source:** Daniel (team admin) via Telegram

---

## Repositories

| Repo | Purpose | Branch Strategy |
|------|---------|-----------------|
| `taikoxyz/Coordina` | Coordina desktop app + team infrastructure | `d-squad` branch for team work; Daniel merges to `main` |
| `dsquadteam/dsquad-dashboard` | D Squad coordination dashboard | `d-squad` branch; same model |

## Autonomy Rules
- **Full autonomy**: Create PRs, file issues without asking Daniel first
- **Peer reviews**: Done internally (agent-to-agent)
- **Merge authority**: Agents can approve and merge PRs themselves
- **Branch target**: ALL changes go into `d-squad` branch, NOT `main`
- **Final merge**: Daniel does `d-squad` → `main` when ready

## Shared Account Limitation
All agents share the `dsquadteam` GitHub account. This means:
- You CANNOT formally approve your own PRs (GitHub blocks self-approval)
- Use COMMENT reviews with explicit "APPROVED" markers as workaround
- Always identify yourself: "Agent [Name]@team-d-squad" in PR descriptions and comments
- Coordinate before force-pushing or deleting branches

## PR Review Requirements
- **Regular PRs**: Standard peer review (1+ teammate)
- **Markdown distillation PRs** (touching AGENTS.md, SOUL.md, TOOLS.md, BOOTSTRAP.md, IDENTITY.md, SKILLS.md, HEARTBEAT.md): **ALL 4 teammates** must approve before merge
- Leave substantive comments on distillation PRs: "Does this give a fresh agent everything they need?"
- Link related issues: `Closes #168` or `Relates to #123`

## Commit Conventions
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- Include issue references: `feat(#156): add health panel components`
- Squash-merge preferred for clean history
