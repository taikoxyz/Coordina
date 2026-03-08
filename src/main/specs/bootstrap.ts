export const DEFAULT_BOOTSTRAP_INSTRUCTIONS = `# Bootstrap Instructions

## Environment Setup
- Verify network connectivity and DNS resolution
- Check available disk space on /workspace

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
