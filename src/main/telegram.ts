import { createAvatar } from "@dicebear/core";
import * as bottts from "@dicebear/bottts-neutral";
import { toJpeg } from "@dicebear/converter";
import { net } from "electron";
import { agentHexColor } from "../shared/agentColors";

export async function syncBotProfilePhoto(
  token: string,
  agentSlug: string,
  colorIndex: number,
): Promise<void> {
  const avatar = createAvatar(bottts, {
    seed: agentSlug,
    size: 512,
    backgroundColor: [agentHexColor(colorIndex)],
  });
  const jpegArrayBuffer = (await toJpeg(avatar).toArrayBuffer()) as ArrayBuffer;

  const form = new FormData();
  form.append(
    "photo",
    JSON.stringify({ type: "static", photo: "attach://avatar_file" }),
  );
  form.append(
    "avatar_file",
    new File([jpegArrayBuffer], "avatar.jpg", { type: "image/jpeg" }),
  );

  let res: Response;
  try {
    res = await net.fetch(
      `https://api.telegram.org/bot${token}/setMyProfilePhoto`,
      { method: "POST", body: form },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Telegram avatar upload network error: ${message}`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Telegram setMyProfilePhoto failed (${res.status}): ${body}`,
    );
  }
}
