import { createAvatar } from '@dicebear/core'
import * as bottts from '@dicebear/bottts-neutral'
import { toPng } from '@dicebear/converter'
import * as https from 'node:https'
import { agentHexColor } from '../shared/agentColors'

function httpsMultipartPost(url: string, fields: Record<string, string>, fileField: string, fileBuffer: Buffer, filename: string, mimeType: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const boundary = `----FormBoundary${Date.now().toString(16)}`
    const parts: Buffer[] = []
    for (const [name, value] of Object.entries(fields)) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`))
    }
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`))
    parts.push(fileBuffer)
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`))
    const body = Buffer.concat(parts)
    const parsed = new URL(url)
    const req = https.request({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length } }, res => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

export async function syncBotProfilePhoto(token: string, agentSlug: string, colorIndex: number): Promise<void> {
  const avatar = createAvatar(bottts, { seed: agentSlug, size: 512, backgroundColor: [agentHexColor(colorIndex)] })
  const pngBuffer = Buffer.from(await toPng(avatar).toArrayBuffer() as ArrayBuffer)
  const res = await httpsMultipartPost(
    `https://api.telegram.org/bot${token}/setMyProfilePhoto`,
    { photo: JSON.stringify({ type: 'static', photo: 'attach://avatar_file' }) },
    'avatar_file', pngBuffer, 'avatar.png', 'image/png'
  )
  if (res.status < 200 || res.status >= 300) throw new Error(`Telegram setMyProfilePhoto failed (${res.status}): ${res.body}`)
}
