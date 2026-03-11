<!-- ============================================================
  BOOTSTRAP.md Template — Coordina Agent Coordination Protocol
  
  This file runs FIRST when an agent starts for the first time.
  Budget: keep under 5,000 chars.

  PLACEHOLDER SYNTAX: This template uses {{PLACEHOLDER}} syntax for variables
  that Coordina replaces at runtime. Example: {{AGENT_SLUG}} becomes "alice-wong".
  
  [HUMAN-AUTHORED] Customized per team/deployment.
  ============================================================ -->

## First Run Setup

Complete these steps on first deployment, then delete this file.

### 1. Install Required CLI Tools

<!-- [HUMAN-AUTHORED] List tools needed for this team. -->

```bash
# Core tools (if not already installed)
apt-get update && apt-get install -y gh git yq jq cargo

# Additional utilities
apt-get install -y bat ripgrep

# Web automation (if needed for browser tasks)
npx -y playwright install --with-deps
```

### 2. Configure External Services

<!-- [HUMAN-AUTHORED] Service-specific setup. -->

#### GitHub
- `gh` CLI is pre-authenticated as `dsquadteam`
- No additional setup needed

#### Email (Gmail)
- Credentials available via environment variables:
  - `EMAIL_ADDRESS`
  - `EMAIL_PASSWORD` (app password)
- Use `dsquad+{{AGENT_SLUG}}@ai.taiko.xyz` format for team emails

### 3. Start Background Services

<!-- [HUMAN-AUTHORED] Services that should auto-start. -->

#### IPFS (if needed for this deployment)

```bash
# Install IPFS
ipfs init

# Create systemd service for auto-start
cat > /etc/systemd/system/ipfs.service << 'EOF'
[Unit]
Description=IPFS Daemon
After=network.target

[Service]
ExecStart=/usr/local/bin/ipfs daemon
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl enable ipfs
systemctl start ipfs
```

### 4. Verify Connectivity

```bash
# Gateway health
curl -s http://127.0.0.1:18789/health

# External API (OpenRouter)
curl -s -m 5 https://openrouter.ai/api/v1/models | head -c 100
```

---

## Delete This File

After completing first-run setup, delete this file:
```bash
rm BOOTSTRAP.md
```
