import * as crypto from 'crypto'
import { Patient, Clinic } from './types'
import { buildRoadmapFlex, buildCompletionFlex } from './flex'

const LINE_API = 'https://api.line.me/v2/bot'

// ---------------------------------------------------------------------------
// Core HTTP — throws on non-2xx so callers know when LINE rejects the call
// ---------------------------------------------------------------------------

async function linePost(path: string, body: object): Promise<{ status: number; body: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const res = await fetch(`${LINE_API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`LINE API ${path} → ${res.status}: ${text}`)
  }
  return { status: res.status, body: text }
}

// ---------------------------------------------------------------------------
// Push / Reply
// ---------------------------------------------------------------------------

export async function pushMessage(lineUserId: string, messages: object[]) {
  return linePost('/message/push', { to: lineUserId, messages })
}

export async function replyMessage(replyToken: string, messages: object[]) {
  return linePost('/message/reply', { replyToken, messages })
}

export async function pushRoadmap(lineUserId: string, patient: Patient, clinics: Clinic[]) {
  const flex = buildRoadmapFlex(patient, clinics)
  return pushMessage(lineUserId, [flex])
}

export async function pushCompletion(lineUserId: string, hn: string) {
  const flex = buildCompletionFlex(hn)
  return pushMessage(lineUserId, [flex])
}

export async function pushText(lineUserId: string, text: string) {
  return pushMessage(lineUserId, [{ type: 'text', text }])
}

export async function replyText(replyToken: string, text: string) {
  return replyMessage(replyToken, [{ type: 'text', text }])
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

export function validateLineSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET ?? ''
  const hash = crypto
    .createHmac('SHA256', secret)
    .update(rawBody)
    .digest('base64')
  return hash === signature
}
