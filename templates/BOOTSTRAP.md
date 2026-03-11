# 🚀 Agent Bootstrap Guide

> **Issue #168** | Layer 2 Infrastructure Optimization  
> This guide ensures a freshly deployed agent has everything needed on day 1.

---

## Overview

This document specifies the **proactive infrastructure requirements** for D Squad agent base images. Unlike reactive bootstrapping (installing tools after deployment), this approach bakes all essentials into the container image, eliminating day-0 setup friction.

**For Dockerfile/image builders:** Use the "Base Image Requirements" section.  
**For deployed agents:** Use the "First Run Verification" section to confirm your environment.

---

## Base Image Requirements

### System Packages

The following must be pre-installed via `apt-get` in the base image:

```dockerfile
RUN apt-get update && apt-get install -y \
    # Core CLI tools
    curl \
    wget \
    git \
    gh \
    jq \
    # Search and viewing
    ripgrep \
    bat \
    # Build tools
    cargo \
    nodejs \
    npm \
    # Email
    swaks \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*
```

| Tool | Purpose | Verify Command |
|------|---------|----------------|
| `curl` | HTTP requests | `curl --version` |
| `wget` | File downloads | `wget --version` |
| `git` | Version control | `git --version` |
| `gh` | GitHub CLI | `gh --version` |
| `jq` | JSON processing | `jq --version` |
| `rg` | Fast text search | `rg --version` |
| `bat` | Syntax-highlighted cat | `bat --version` |
| `cargo` | Rust package manager | `cargo --version` |
| `nodejs` | JavaScript runtime | `node --version` |
| `npm` | Node package manager | `npm --version` |
| `swaks` | SMTP email testing | `swaks --version` |

### Standalone Binaries

Install these directly to `/usr/local/bin` (or `/agent-data/openclaw/tools/`):

```dockerfile
# YQ - YAML processor
ARG YQ_VERSION=v4.40.5
RUN wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/yq_linux_amd64 \
    && chmod +x /usr/local/bin/yq

# IPFS (Kubo)
ARG IPFS_VERSION=v0.24.0
RUN cd /tmp \
    && wget -q https://dist.ipfs.tech/kubo/${IPFS_VERSION}/kubo_${IPFS_VERSION}_linux-amd64.tar.gz \
    && tar -xzf kubo_${IPFS_VERSION}_linux-amd64.tar.gz \
    && cd kubo \
    && ./install.sh \
    && rm -rf /tmp/kubo*
```

| Tool | Purpose | Verify Command |
|------|---------|----------------|
| `yq` | YAML processing | `yq --version` |
| `ipfs` | Distributed storage | `ipfs --version` |

### Global NPM Packages

```dockerfile
RUN npm install -g playwright
```

| Package | Purpose | Verify Command |
|---------|---------|----------------|
| `playwright` | Browser automation | `npx playwright --version` |

### Environment Variables

The following must be available in the container environment:

| Variable | Purpose | Source |
|----------|---------|--------|
| `GITHUB_TOKEN` | GitHub API access | Kubernetes secret |
| `EMAIL_ADDRESS` | Gmail account | Kubernetes secret |
| `EMAIL_PASSWORD` | Gmail app password | Kubernetes secret |
| `OPENROUTER_API_KEY` | LLM API access | Kubernetes secret |
| `K8S_NAMESPACE` | Peer discovery | Pod metadata |

### Directory Structure

Ensure these directories exist with appropriate permissions:

```dockerfile
RUN mkdir -p \
    /agent-data/openclaw/workspace \
    /agent-data/openclaw/workspace/memory \
    /agent-data/openclaw/workspace/docs \
    /agent-data/openclaw/tools \
    /agent-data/openclaw/state

ENV PATH="/agent-data/openclaw/tools:${PATH}"
```

---

## First Run Verification

If this is your first deployment, verify everything is ready:

### 1. Health Check (10 seconds)

```bash
# Gateway health
curl -s http://127.0.0.1:18789/health

# Disk space (should show >1GB available)
df -h /agent-data | tail -1

# Memory (should show >100MB available)
cat /proc/meminfo | grep MemAvailable
```

### 2. Tool Verification (20 seconds)

Run this one-liner to verify all tools:

```bash
echo "=== D Squad Tool Verification ===" && \
curl --version | head -1 && \
wget --version | head -1 && \
git --version && \
gh --version && \
jq --version && \
yq --version && \
cargo --version && \
node --version && \
npm --version && \
npx playwright --version && \
bat --version && \
rg --version && \
ipfs --version && \
swaks --version | head -1 && \
echo "=== All tools verified ==="
```

### 3. Environment Verification (10 seconds)

```bash
# Verify required env vars are set
env | grep -E "^(GITHUB_TOKEN|EMAIL_ADDRESS|OPENROUTER_API_KEY|K8S_NAMESPACE)" | cut -d= -f1
```

Expected output shows all four variable names (values hidden for security).

### 4. Peer Connectivity (20 seconds)

```bash
# Check teammate gateways
echo "alice-wong: $(curl -s -m 5 http://agent-alice-wong.team-d-squad.svc.cluster.local:18789/health 2>/dev/null || echo 'unreachable')"
echo "bob-li: $(curl -s -m 5 http://agent-bob-li.team-d-squad.svc.cluster.local:18789/health 2>/dev/null || echo 'unreachable')"
echo "ripley: $(curl -s -m 5 http://agent-ripley.team-d-squad.svc.cluster.local:18789/health 2>/dev/null || echo 'unreachable')"
echo "deckard: $(curl -s -m 5 http://agent-deckard.team-d-squad.svc.cluster.local:18789/health 2>/dev/null || echo 'unreachable')"
```

---

## Essential Reading

Read these files in order before starting work:

1. **`AGENTS.md`** → Team Operating Instructions + Team Directory
   - How we communicate (gateway HTTP API, NOT Telegram)
   - Who's who and their gateway endpoints
   - Your role and responsibilities

2. **`IDENTITY.md`** → Your persona and configuration

3. **`SOUL.md`** → Core behavioral principles

4. **`TOOLS.md`** → Available tools and how to use them

5. **`TELEGRAM_RULES.md`** → Telegram group chat protocols

---

## First Task Checklist

- [ ] Health check passed (gateway responds, disk/memory OK)
- [ ] Tool verification passed (all 13 tools report versions)
- [ ] Environment verification passed (all 4 env vars set)
- [ ] Peer connectivity verified (teammates reachable)
- [ ] Read `AGENTS.md` completely
- [ ] Read your `IDENTITY.md` and `SOUL.md`
- [ ] Verified `gh auth status` (GitHub CLI authenticated)
- [ ] Located teammates' gateways in `AGENTS.md`
- [ ] **Deleted this BOOTSTRAP.md file** (keep workspace clean)

---

## Troubleshooting

| Issue | Check | Fix |
|-------|-------|-----|
| Gateway not responding | `ps aux \| grep openclaw` | Restart container |
| Tool missing | `which <tool>` | Rebuild base image with tool |
| DNS failure | `cat /etc/resolv.conf` | Check cluster DNS |
| Disk full | `df -h /agent-data` | Clean workspace files |
| Cannot reach peers | Verify `K8S_NAMESPACE` | Check pod networking |
| High memory | `cat /proc/meminfo` | Restart if critically low |

---

## Dockerfile Reference (Complete)

```dockerfile
# D Squad Agent Base Image
FROM ubuntu:22.04

# Install system packages
RUN apt-get update && apt-get install -y \
    curl wget git gh jq \
    ripgrep bat cargo \
    nodejs npm swaks \
    && rm -rf /var/lib/apt/lists/*

# Install YQ
ARG YQ_VERSION=v4.40.5
RUN wget -qO /usr/local/bin/yq \
    https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/yq_linux_amd64 \
    && chmod +x /usr/local/bin/yq

# Install IPFS
ARG IPFS_VERSION=v0.24.0
RUN cd /tmp \
    && wget -q https://dist.ipfs.tech/kubo/${IPFS_VERSION}/kubo_${IPFS_VERSION}_linux-amd64.tar.gz \
    && tar -xzf kubo_${IPFS_VERSION}_linux-amd64.tar.gz \
    && cd kubo \
    && ./install.sh \
    && rm -rf /tmp/kubo*

# Install Playwright
RUN npm install -g playwright

# Create workspace structure
RUN mkdir -p /agent-data/openclaw/workspace/memory \
    /agent-data/openclaw/workspace/docs \
    /agent-data/openclaw/tools \
    /agent-data/openclaw/state

ENV PATH="/agent-data/openclaw/tools:${PATH}"

# Expected environment variables (inject at runtime):
# GITHUB_TOKEN, EMAIL_ADDRESS, EMAIL_PASSWORD, OPENROUTER_API_KEY, K8S_NAMESPACE
```

---

## Need Help?

- **Team lead:** alice-wong (gateway: `http://agent-alice-wong.team-d-squad.svc.cluster.local:18789`)
- **Team admin:** Telegram @8379033654
- **Docs:** `TOOLS.md`, `AGENTS.md`, local `/agent-data/openclaw/workspace/docs/`

---

**D Squad** | Issue #168 | Proactive Infrastructure ✅
