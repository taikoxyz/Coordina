import { createAvatar } from '@dicebear/core'
import * as bottts from '@dicebear/bottts-neutral'
import { toPng } from '@dicebear/converter'
import { agentHexColor } from '../shared/agentColors'

export async function syncBotProfilePhoto(token: string, agentSlug: string, colorIndex: number): Promise<void> {
  const avatar = createAvatar(bottts, { seed: agentSlug, size: 512, backgroundColor: [agentHexColor(colorIndex)] })
  const pngArrayBuffer = await toPng(avatar).toArrayBuffer() as ArrayBuffer

  const form = new FormData()
  form.append('photo', JSON.stringify({ type: 'static', photo: 'attach://avatar_file' }))
  form.append('avatar_file', new Blob([pngArrayBuffer], { type: 'image/png' }), 'avatar.png')

  const res = await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Telegram setMyProfilePhoto failed (${res.status}): ${body}`)
  }
}
