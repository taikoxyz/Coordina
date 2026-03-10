export const DEFAULT_BOOTSTRAP_INSTRUCTIONS = `# Bootstrap Instructions

## Environment Setup
- Read ENV.md to understand your deployment context
- Verify environment variables: \`env | grep -E "^(K8S_|OPENCLAW_)" | sort\`
- Verify network connectivity: \`curl -s -m 5 https://openrouter.ai/api/v1/models | head -c 100\`
- Check DNS resolution: \`nslookup kubernetes.default.svc.cluster.local\`
- Check available disk space: \`df -h /agent-data\`
- Verify gateway is healthy: \`curl -s http://127.0.0.1:18789/v1/version\`

## Tool Installation
- Tools install to /agent-data/openclaw/tools/ (on PATH, persists across restarts)
- npm: \`npm install -g <package>\` (no sudo needed, NPM_CONFIG_PREFIX is set)
- Python: \`pip install <package>\` (PIP_USER=true, installs to PYTHONUSERBASE)
- Go: \`go install <package>@latest\` (GOPATH is set)
- Cargo: \`cargo install <package>\` (CARGO_HOME is set)
- Install project dependencies as defined in the team configuration
- Configure git with the agent's identity (name and email from IDENTITY.md)

## Workspace Initialization
- Clone or pull the team repository if configured
- Create working directories under /workspace

## Verification
- Confirm all tools are accessible
- Log bootstrap completion status

## Cleanup
- Remove temporary installation artifacts
- Delete /workspace/BOOTSTRAP.md to signal bootstrap complete
`
