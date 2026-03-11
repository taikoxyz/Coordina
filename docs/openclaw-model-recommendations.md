# OpenClaw Model Recommendations for Layer 2 Infrastructure Optimization

**Research Date:** March 2026  
**Team:** D Squad  
**Use Case:** OpenClaw agents running on GKE for multi-agent coordination, K8s YAML generation, infrastructure code review, agent-to-agent gateway communication, and cost-performance optimization.

## Executive Summary

This report provides model recommendations optimized for Layer 2 infrastructure workloads. After analyzing 300+ models available on OpenRouter, we've identified cost-effective configurations that balance performance with operational efficiency for agent-to-agent coordination at scale.

---

## Model Categories & Recommendations

### 1. High-Throughput / Low-Latency Models

*For heartbeat checks, simple API calls, status polling, and high-frequency health monitoring*

| Model ID | Provider | Input/1M | Output/1M | Context | Speed Tier | Best Use |
|----------|----------|----------|-----------|---------|------------|----------|
| `google/gemini-3.1-flash-lite-preview` | Google | $0.25 | $1.50 | 1,048,576 | **Fast** | Preferred for heartbeat checks |
| `qwen/qwen3.5-flash` | Alibaba | $0.10 | $0.40 | 1,000,000 | **Fast** | Ultra-cheap high-volume tasks |
| `inception/mercury-2` | Inception | $0.25 | $0.75 | 128,000 | **Extremely Fast** | >1000 tokens/sec, parallel generation |
| `bytedance-seed/seed-2.0-mini` | ByteDance | $0.10 | $0.40 | 262,144 | **Fast** | Cost-sensitive, latency-optimized |

**Recommendation:** Use `google/gemini-3.1-flash-lite-preview` as the **fastModel**. It offers the best balance of 1M context window, very low per-token pricing, and high throughput for agent health checks and status polling.

---

### 2. Strong Code Generation Models

*For Kubernetes YAML, Dockerfiles, Terraform configs, infrastructure code review*

| Model ID | Provider | Input/1M | Output/1M | Context | Speed Tier | Best Use |
|----------|----------|----------|-----------|---------|------------|----------|
| `openai/gpt-5.3-codex` | OpenAI | $1.75 | $14.00 | 400,000 | Medium | Agentic coding, multi-file orchestration |
| `google/gemini-3.1-pro-preview` | Google | $2.00 | $12.00 | 1,048,576 | Medium | K8s YAML, structured configs, tool use |
| `anthropic/claude-sonnet-4.6` | Anthropic | $3.00 | $15.00 | 1,000,000 | Medium | Complex refactoring, code review |
| `qwen/qwen3.5-plus-02-15` | Alibaba | $0.26 | $1.56 | 1,000,000 | Fast | Cost-effective code generation |

**Recommendation:** Use `openai/gpt-5.3-codex` as the **codeModel**. It achieves state-of-the-art results on SWE-Bench Pro (57.7%) and Terminal-Bench 2.0, with 25% faster inference than previous Codex versions. For cost-sensitive workloads, `qwen/qwen3.5-plus-02-15` provides excellent quality at 10x lower cost.

---

### 3. Cost-Effective Balanced Option

*For general sub-agent tasks, everyday coordination, mixed workloads*

| Model ID | Provider | Input/1M | Output/1M | Context | Speed Tier | Best Use |
|----------|----------|----------|-----------|---------|------------|----------|
| `google/gemini-3.1-flash-lite-preview` | Google | $0.25 | $1.50 | 1,048,576 | Fast | **Default for general tasks** |
| `openai/gpt-5.3-chat` | OpenAI | $1.75 | $14.00 | 128,000 | Fast | Smoother conversational flow |
| `qwen/qwen3.5-9b` | Alibaba | $0.10 | $0.15 | 262,144 | Fast | Cheapest viable option |
| `openai/gpt-5.4` | OpenAI | $2.50 | $15.00 | 1,050,000 | Medium | Strong default for general + code |

**Recommendation:** Use `google/gemini-3.1-flash-lite-preview` as the **defaultModel**. At $0.25/$1.50 per 1M tokens with a 1M context window, it offers exceptional value for general agent coordination tasks while maintaining quality comparable to frontier models.

---

### 4. High-Quality Reasoning Models

*For complex coordination decisions, multi-step problem solving, strategy planning*

| Model ID | Provider | Input/1M | Output/1M | Context | Speed Tier | Best Use |
|----------|----------|----------|-----------|---------|------------|----------|
| `anthropic/claude-opus-4.6` | Anthropic | $5.00 | $25.00 | 1,000,000 | Slow | Most complex reasoning, agent planning |
| `openai/gpt-5.4` | OpenAI | $2.50 | $15.00 | 1,050,000 | Medium | High-context reasoning, coding |
| `openai/gpt-5.4-pro` | OpenAI | $30.00 | $180.00 | 1,050,000 | Slow | Maximum accuracy for critical decisions |
| `qwen/qwen3.5-397b-a17b` | Alibaba | $0.39 | $2.34 | 262,144 | Medium | Cost-efficient reasoning |

**Recommendation:** For **reasoningModel**, use `anthropic/claude-opus-4.6` when maximum reasoning capability is needed for critical coordination decisions. For a balance of cost and quality, `openai/gpt-5.4` provides 1M context window and strong reasoning at half the cost.

---

## Cost-Performance Analysis

### Monthly Cost Estimates (assuming 1B tokens/month)

| Configuration | Total Cost | Use Case |
|---------------|------------|----------|
| **Budget Tier** (Flash Lite + Qwen) | ~$350-500 | Cost-first optimization |
| **Balanced Tier** (Gemini Flash + GPT-5.4) | ~$1,500-2,500 | Quality/cost balance |
| **Premium Tier** (Claude Opus + GPT-Codex) | ~$5,000-8,000 | Maximum capability |

### OpenRouter Platform Fees
- **Non-crypto payments**: 5.5% + $0.80 min platform fee
- **Crypto payments**: 5.0% flat platform fee
- **BYOK (Bring Your Own Key)**: 5% fee transitioning to monthly subscription

---

## Model Selection Strategy for D Squad

Given your specific workload:
1. **K8s YAML generation** → Use `gpt-5.3-codex` (codeModel)
2. **Infrastructure code review** → Use `claude-opus-4.6` (reasoningModel)
3. **Agent-to-agent gateway** → Use `gemini-3.1-flash-lite-preview` (fastModel for heartbeats)
4. **General sub-agent tasks** → Use `gemini-3.1-flash-lite-preview` (defaultModel)
5. **Cost-performance optimization** → Use `qwen3.5-flash` for high-volume, simple tasks

---

## Context Window Considerations

| Task Type | Recommended Min Context | Rationale |
|-----------|------------------------|-----------|
| Heartbeat/Health | 128K | Sufficient for simple status checks |
| K8s YAML Gen | 400K | Large manifests need 400K+ tokens |
| Code Review | 1M | Full codebase analysis requires 1M |
| Multi-Agent Coord | 1M | Memory across agent conversations |

---

## Notes

- All pricing reflects OpenRouter pass-through rates as of March 2026
- OpenRouter adds automatic provider fallbacks for high uptime
- Model availability and pricing subject to change; monitor OpenRouter catalog
- For maximum cost control, consider BYOK with bring-your-own-keys from providers

---

**Document Version:** 1.0  
**Next Review:** April 2026
