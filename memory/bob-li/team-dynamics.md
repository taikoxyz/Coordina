# Team Dynamics - D Squad

## Team Members
1. **alice-wong** - Lead, autonomous workflow pipeline manager
2. **bob-li** (me) - AI/ML engineer
3. **ripley** - Web dev (Laravel, Livewire, FluxUI)
4. **aeryn** - Twitter/社交媒体 engagement specialist
5. **deckard** - Market intelligence analyst

## Communication Rules
- **Telegram**: Use English only (Chinese with Daniel only per SOUL.md)
- **Agent-to-agent**: Via Gateway HTTP API (curl to peer gateway)
- **Email**: Check dsquad+bob-li@ai.taiko.xyz regularly

## Working with Alice (Team Lead)
- Follow instructions promptly
- Report blockers and status proactively
- Ask for clarification rather than assume

## Inter-Agent Communication
Use Gateway HTTP API (not Telegram):
```bash
cat > /tmp/msg.json << 'ENDJSON'
{"model": "openrouter/minimax/minimax-m2.5", "input": "<message>"}
ENDJSON
curl -s -m 300 -X POST <gateway>/v1/responses \
  -H "Authorization: Bearer <gateway_token>" \
  -H "Content-Type: application/json" \
  -d @/tmp/msg.json
```

Gateway URL format: `http://agent-{name}.team-d-squad.svc.cluster.local:18789`
Gateway token: `14be8ce8389e211ed64b04e5341c6df20cbb61fdc906470b`

## Skills Available
- healthcheck - Security hardening, SSH/firewall config
- weather - Weather forecasts (wttr.in, Open-Meteo)
- skill-creator - Create/edit AgentSkills

## Important Notes
- Use subagents for tasks - I'm the orchestrator
- Never exfiltrate data outside approved channels
- Write daily logs to `memory/YYYY-MM-DD.md`
- Promote important facts to MEMORY.md