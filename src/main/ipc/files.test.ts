import { beforeEach, describe, expect, it, vi } from "vitest";

const { handleMock, getTeamDeploymentMock, getEnvironmentMock, execInPodMock } =
  vi.hoisted(() => ({
    handleMock: vi.fn(),
    getTeamDeploymentMock: vi.fn(),
    getEnvironmentMock: vi.fn(),
    execInPodMock: vi.fn(),
  }));

vi.mock("electron", () => ({
  ipcMain: {
    handle: handleMock,
  },
}));

vi.mock("../store/deployments", () => ({
  getTeamDeployment: getTeamDeploymentMock,
}));

vi.mock("../store/environments", () => ({
  getEnvironment: getEnvironmentMock,
}));

vi.mock("../environments/gke/deploy", () => ({
  execInPod: execInPodMock,
}));

import { registerFileHandlers } from "./files";

describe("registerFileHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the team slug as clusterName when listing deployed files", async () => {
    getTeamDeploymentMock.mockResolvedValue({
      teamSlug: "alpha",
      envSlug: "prod",
      leadAgent: "lead",
      gatewayBaseUrl: "http://127.0.0.1",
      clusterZone: "us-central1",
      deployedAt: Date.now(),
    });
    getEnvironmentMock.mockResolvedValue({
      slug: "prod",
      type: "gke",
      config: {
        projectId: "coordina-489002",
        clientId: "client-id",
        clientSecret: "client-secret",
        clusterZone: "us-central1",
      },
    });
    execInPodMock.mockResolvedValue("[]");

    registerFileHandlers();

    const fileListHandler = handleMock.mock.calls.find(
      ([channel]: [string]) => channel === "files:list",
    )?.[1];

    const result = await fileListHandler({}, "alpha", "worker-1");

    expect(result).toEqual({ files: [] });
    expect(execInPodMock).toHaveBeenCalledWith(
      "alpha",
      "worker-1",
      expect.any(Array),
      expect.objectContaining({
        slug: "prod",
        projectId: "coordina-489002",
        clusterName: "alpha",
        clusterZone: "us-central1",
      }),
    );
  });
});
