# Technical Patterns - Ripley

## Dashboard Architecture
- Laravel + Livewire + FluxUI stack
- DashboardApiClient: handles primary→fallback API pattern
- MockDataService: provides fallback data when Bob's API unreachable
- SSE client: real-time updates with smart polling fallback

## Key Endpoints
- Bob's API (port 19876): /api/v1/projects, /api/v1/tasks, /api/v1/agents, /api/v1/events (SSE)
- Fallback: MockDataService class
- Proxy route: /sse/events → forwards to Bob's API

## Port 19876 Blocker
- Bob's API runs inside his pod on port 19876
- Cross-pod connectivity requires K8s Service (specs/project-api.yaml)
- If unreachable, dashboard automatically falls back to mock data

## SSE Event Types
- task.created, task.updated, task.deleted
- agent.status_changed
- project.created, project.updated
- NOTE: Bob's server does NOT emit project.deleted events

## Git Workflow
- All changes → d-squad branch
- Daniel merges d-squad → main
- Use shared dsquadteam GitHub account

## Inter-Agent Communication
- Use gateway HTTP API (not Telegram)
- Telegram is for admin-to-agent only
- Format: curl to teammate's gateway URL with gateway_token
