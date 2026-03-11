import type { DeployReadinessResult, TeamSpec } from "../../shared/types";

interface TelegramDeployReadinessOptions {
  agentSlug?: string;
  hasToken: (agentSlug: string) => Promise<boolean>;
}

const normalizeOptional = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export async function getTelegramDeployReadiness(
  spec: TeamSpec,
  options: TelegramDeployReadinessOptions,
): Promise<DeployReadinessResult> {
  const telegramGroupId = normalizeOptional(spec.telegramGroupId);
  const telegramAdminId = normalizeOptional(spec.telegramAdminId);

  if (Boolean(telegramGroupId) !== Boolean(telegramAdminId)) {
    return {
      ok: false,
      reason: "Telegram team routing requires both Group ID and Admin ID",
    };
  }

  const agents = options.agentSlug
    ? spec.agents.filter((agent) => agent.slug === options.agentSlug)
    : spec.agents;

  for (const agent of agents) {
    const botId = normalizeOptional(agent.telegramBot);
    const hasToken = await options.hasToken(agent.slug);
    const usesTelegram = Boolean(botId || hasToken);

    if (!usesTelegram) continue;

    if (!telegramGroupId || !telegramAdminId) {
      return {
        ok: false,
        reason: `Telegram is partially configured for ${agent.slug}: missing team Group ID/Admin ID`,
      };
    }

    if (!botId) {
      return {
        ok: false,
        reason: `Telegram is partially configured for ${agent.slug}: missing bot ID`,
      };
    }

    if (!hasToken) {
      return {
        ok: false,
        reason: `Telegram is partially configured for ${agent.slug}: missing bot token`,
      };
    }
  }

  return { ok: true };
}
