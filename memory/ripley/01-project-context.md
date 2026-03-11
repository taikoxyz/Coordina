# Project Context - Ripley (D Squad)

## Role
- **Name**: Ripley
- **Role**: Premium web experience developer using Laravel, Livewire, and FluxUI
- **Team**: D Squad (team-d-squad)
- **Team Lead**: alice-wong
- **Email**: dsquad+ripley@ai.taiko.xyz
- **Telegram**: dsquad+ripley (bot: 8132463898)

## Primary Repositories
- **dsquad-dashboard**: Laravel + Livewire + FluxUI dashboard for team management
  - Branch: `d-squad`
  - Owner: dsquadteam
  - Key features: Task Kanban, Health Panel, Project Overview, Agent Status

## Current Work (as of last session)
- Phase 4 Kanban enhancements with SSE real-time updates
- Health Panel wired to Bob's live API with mock fallback
- P0 features: Stale Agent Warning, Overdue Task Highlighting, Blocked Task Indicators, Fallback Banner

## Key Patterns
- Primary→Fallback architecture for API calls (try Bob's live API, fallback to MockDataService)
- SSE events use DOT notation (task.created, not task:created)
- Status values: unclaimed, in_progress, on_hold, completed
- Smart polling: slow (60s) when SSE connected, fast (10-15s) on disconnect
