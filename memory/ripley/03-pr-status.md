# PR Status - dsquad-dashboard

## Open PRs (d-squad branch)
- **PR #9**: Kanban enhancements - feat/phase4-kanban-enhancements → d-squad
- **PR #6**: Health Panel - feature/156-health-panel → d-squad
- **PR #13**: SSE Livewire wiring - feat/sse-livewire-wiring → d-squad
- **PR #21**: Health Panel shippable - feat/health-panel-shippable → d-squad

## Recently Merged (d-squad)
- PR #147: additionalPorts for Bob's API (Coordina main)
- PR #181: K8s Service for port 19876 (Coordina main)

## Blockers
- Port 19876 not yet exposed cross-pod (awaiting redeploy)
- Health Panel Phase 3 pending Bob's token tracking (#134) and message log (#135)

## Issue References
- Issue #156: Collaboration Health Panel
- Issue #5: UX Polish enhancements

## Key Files
- app/Livewire/DashboardApiClient.php - API client with fallback
- app/Services/MockDataService.php - Fallback data
- resources/views/livewire/task-kanban.blade.php - Kanban board
- resources/views/livewire/health/ - Health panel components
- public/js/sse-client.js - SSE client
