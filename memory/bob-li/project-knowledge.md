# Project Knowledge - Coordina

## Overview
Coordina is an agent management/dashboard system built with TypeScript/Node.js. It manages OpenClaw agents for the Taiko ecosystem.

## Key Components

### 1. Dashboard (`dsquad-dashboard/`)
- React-based frontend dashboard
- Manages team agents and specs
- Located in `/workspace/dsquad-dashboard`

### 2. Project API (`project-api/`)
- Node.js API server on port 19876
- Health check endpoint: /health
- Started via: `cd /agent-data/openclaw/workspace/project-api && mkdir -p /data && PORT=19876 nohup node server.js &`
- See HEARTBEAT.md for auto-restart logic

### 3. OpenClaw Configuration
- Main config: `/agent-data/openclaw/workspace/openclaw` (or `/openclaw`)
- Agent specs in JSON format
- Team-specific configs in templates/

## Important Specs
- `specs/dashboard-architecture.md` - Dashboard design
- `specs/project-api-deployment.yaml` - Project API K8s deployment
- `specs/ipfs-sidecar.yaml` - IPFS integration
- `specs/github-workflow.md` - GitHub automation

## GitHub Workflow
- Repo: taikoxyz/Coordina
- Branch: d-squad (main working branch)
- Use `gh` CLI for issues, PRs, commits
- Authenticated as: dsquadteam

## Deployment
- GKE (Google Kubernetes Engine) based
- Manifests in `src/main/environments/gke/`
- Pod defaults in `src/shared/podDefaults.ts`

## Key Patterns
- Team specs normalized via `src/main/validation/teamSpecNormalize.ts`
- JSON validation in `src/shared/validateJsonEdit.ts`
- Types defined in `src/shared/types.ts`

## Common Commands
```bash
# Check gateway health
curl -s http://127.0.0.1:18789/health

# Check peer connectivity
curl -s -m 5 http://agent-alice-wong.team-d-squad.svc.cluster.local:18789/health

# Start project API
cd /agent-data/openclaw/workspace/project-api && PORT=19876 node server.js &

# Git operations
gh repo clone taikoxyz/Coordina
gh pr create --title "..." --body "..."
```