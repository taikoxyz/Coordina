import { describe, expect, it } from "vitest";
import { getDeployDisabledState } from "./deployGuard";

describe("getDeployDisabledState", () => {
  it("disables deploy when Telegram readiness fails", () => {
    expect(
      getDeployDisabledState({
        hasGkeConfig: true,
        isAnyDeploying: false,
        isThisDeploying: false,
        readiness: {
          ok: false,
          reason:
            "Telegram is partially configured for achilles: missing bot token",
        },
      }),
    ).toEqual({
      disabled: true,
      title: "Telegram is partially configured for achilles: missing bot token",
      hint: "Telegram is partially configured for achilles: missing bot token",
    });
  });

  it("does not disable deploy when Telegram readiness passes", () => {
    expect(
      getDeployDisabledState({
        hasGkeConfig: true,
        isAnyDeploying: false,
        isThisDeploying: false,
        readiness: { ok: true },
      }),
    ).toEqual({
      disabled: false,
      title: undefined,
      hint: undefined,
    });
  });
});
