import type { DeployReadinessResult } from "../../../../shared/types";

interface DeployDisabledStateInput {
  hasGkeConfig: boolean;
  isAnyDeploying: boolean;
  isThisDeploying: boolean;
  readiness?: DeployReadinessResult;
}

export function getDeployDisabledState({
  hasGkeConfig,
  isAnyDeploying,
  isThisDeploying,
  readiness,
}: DeployDisabledStateInput): {
  disabled: boolean;
  title?: string;
  hint?: string;
} {
  if (!hasGkeConfig) {
    return {
      disabled: true,
      title: "Configure Google Cloud in Settings first",
      hint: "Configure Google Cloud in Settings",
    };
  }

  if (isAnyDeploying && !isThisDeploying) {
    return {
      disabled: true,
      title: "Another deployment is in progress",
      hint: undefined,
    };
  }

  if (readiness && !readiness.ok) {
    return {
      disabled: true,
      title: readiness.reason,
      hint: readiness.reason,
    };
  }

  return {
    disabled: false,
    title: undefined,
    hint: undefined,
  };
}
