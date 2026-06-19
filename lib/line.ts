import * as crypto from 'crypto'
import { Patient, Clinic } from './types'
import { buildRoadmapFlex, buildCompletionFlex } from './flex'

// ---------------------------------------------------------------------------
// LINE Messaging API client (minimal fetch-based wrapper to avoid SDK
// version conflicts in Edge / server components)
// ---------------------------------------------------------------------------

const LINE_API = 'https://api.line.me/v2/bot'

async function linePost(path: string, body: object) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const res = await fetch(`${LINE_API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error(`LINE API error ${res.status}: ${text}`)
  }
}

export async function pushMessage(lineUserId: string, messages: object[]) {
  await linePost('/message/push', { to: lineUserId, messages })
}

export async function replyMessage(replyToken: string, messages: object[]) {
  await linePost('/message/reply', { replyToken, messages })
}

export async function pushRoadmap(lineUserId: string, patient: Patient, clinics: Clinic[]) {
  const flex = buildRoadmapFlex(patient, clinics)
  await pushMessage(lineUserId, [flex])
}

export async function pushCompletion(lineUserId: string, hn: string) {
  const flex = buildCompletionFlex(hn)
  await pushMessage(lineUserId, [flex])
}

export async function pushText(lineUserId: string, text: string) {
  await pushMessage(lineUserId, [{ type: 'text', text }])
}

export async function replyText(replyToken: string, text: string) {
  await replyMessage(replyToken, [{ type: 'text', text }])
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
