import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockNetFetch, mockToJpeg } = vi.hoisted(() => ({
  mockNetFetch: vi.fn(),
  mockToJpeg: vi.fn(() => ({
    toArrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  })),
}));

vi.mock("@dicebear/core", () => ({
  createAvatar: vi.fn(() => ({ mocked: true })),
}));

vi.mock("@dicebear/converter", () => ({
  toJpeg: mockToJpeg,
  toPng: mockToJpeg,
}));

vi.mock("electron", () => ({
  net: {
    fetch: mockNetFetch,
  },
}));

import { syncBotProfilePhoto } from "./telegram";

describe("syncBotProfilePhoto", () => {
  beforeEach(() => {
    mockNetFetch.mockReset();
    mockToJpeg.mockClear();
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("global fetch should not be used"));
  });

  it("uploads a JPEG avatar using Electron net.fetch", async () => {
    mockNetFetch.mockResolvedValue(new Response("", { status: 200 }));

    await syncBotProfilePhoto("123:abc", "alpha", 0);

    expect(mockNetFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockNetFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:abc/setMyProfilePhoto");
    expect(init.method).toBe("POST");

    const form = init.body as FormData;
    expect(form.get("photo")).toBe(
      JSON.stringify({ type: "static", photo: "attach://avatar_file" }),
    );

    const avatar = form.get("avatar_file");
    expect(avatar).toBeInstanceOf(File);
    expect((avatar as File).type).toBe("image/jpeg");
    expect((avatar as File).name).toBe("avatar.jpg");
  });

  it("surfaces network failures with Telegram context", async () => {
    mockNetFetch.mockRejectedValue(new TypeError("fetch failed"));

    await expect(syncBotProfilePhoto("123:abc", "alpha", 0)).rejects.toThrow(
      "Telegram avatar upload network error: fetch failed",
    );
  });
});
