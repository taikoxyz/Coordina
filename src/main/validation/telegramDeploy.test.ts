import { describe, expect, it, vi } from "vitest";
import type { TeamSpec } from "../../shared/types";
import { getTelegramDeployReadiness } from "./telegramDeploy";

const baseSpec: TeamSpec = {
  slug: "team-auto-research",
  name: "Auto Research",
  leadAgent: "achilles",
  agents: [
    {
      slug: "achilles",
      name: "Achilles",
      role: "Lead",
      skills: [],
      persona: "Focused",
      models: ["openrouter/moonshotai/kimi-k2.5"],
    },
    {
      slug: "apollo",
      name: "Apollo",
      role: "Researcher",
      skills: [],
      persona: "Calm",
      models: ["deepseek/deepseek-v3.2"],
    },
  ],
};

describe("getTelegramDeployReadiness", () => {
  it("allows deploys when Telegram is unused", async () => {
    await expect(
      getTelegramDeployReadiness(baseSpec, {
        hasToken: vi.fn().mockResolvedValue(false),
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("rejects deploy when an agent has a bot id but no token", async () => {
    const spec: TeamSpec = {
      ...baseSpec,
      telegramGroupId: "-1001234567890",
      telegramAdminId: "222222222",
      agents: baseSpec.agents.map((agent) =>
        agent.slug === "achilles"
          ? { ...agent, telegramBot: "8685060319" }
          : agent,
      ),
    };

    await expect(
      getTelegramDeployReadiness(spec, {
        hasToken: vi.fn().mockResolvedValue(false),
      }),
    ).resolves.toEqual({
      ok: false,
      reason:
        "Telegram is partially configured for achilles: missing bot token",
    });
  });

  it("rejects deploy when a token exists without a bot id", async () => {
    const spec: TeamSpec = {
      ...baseSpec,
      telegramGroupId: "-1001234567890",
      telegramAdminId: "222222222",
    };

    await expect(
      getTelegramDeployReadiness(spec, {
        agentSlug: "achilles",
        hasToken: vi.fn().mockResolvedValue(true),
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "Telegram is partially configured for achilles: missing bot ID",
    });
  });
});
