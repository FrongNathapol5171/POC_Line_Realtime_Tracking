import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import {
  getPatientByToken,
  upsertPatient,
  appendEvent,
  appendHelpRequest,
  getClinics,
} from '@/lib/sheets'
import { validateLineSignature, pushRoadmap, pushText, replyText } from '@/lib/line'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (!validateLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const body = JSON.parse(rawBody)
  const events: LineEvent[] = body.events ?? []

  // Respond 200 immediately; process asynchronously
  processEvents(events).catch(console.error)

  return NextResponse.json({ ok: true })
}

type LineEvent = {
  type: string
  replyToken?: string
  source: { userId: string }
  message?: { type: string; text: string }
  postback?: { data: string }
}

async function processEvents(events: LineEvent[]) {
  for (const event of events) {
    if (event.type === 'message' && event.message?.type === 'text') {
      await handleBindingMessage(event)
    } else if (event.type === 'postback') {
      await handlePostback(event)
    }
  }
}

async function handleBindingMessage(event: LineEvent) {
  const text = event.message?.text ?? ''
  const lineUserId = event.source.userId
  const replyToken = event.replyToken ?? ''

  // Parse: "ลงทะเบียนผู้ป่วย HN: HN0001 | TOKEN: <token>"
  const tokenMatch = text.match(/TOKEN:\s*([a-f0-9-]+)/i)
  const hnMatch = text.match(/HN:\s*([^\s|]+)/i)
  if (!tokenMatch || !hnMatch) return

  const token = tokenMatch[1].trim()
  const hn = hnMatch[1].trim()

  const result = await getPatientByToken(token)
  if (!result) {
    await replyText(replyToken, `ไม่พบข้อมูลการลงทะเบียน (HN: ${hn}) กรุณาติดต่อเจ้าหน้าที่`)
    return
  }

  const { patient } = result

  // Idempotent: already bound
  if (patient.bindTokenUsed) {
    await replyText(replyToken, 'บัญชีนี้เชื่อมต่อกับ LINE แล้ว / Already linked.')
    return
  }

  const now = new Date().toISOString()
  patient.lineUserId = lineUserId
  patient.bindTokenUsed = true
  patient.status = 'BOUND'
  patient.updatedAt = now

  await upsertPatient(patient)
  await appendEvent({
    eventId: crypto.randomUUID(),
    hn: patient.hn,
    clinicId: JSON.parse(patient.sequenceJson)[0] ?? '',
    type: 'BOUND',
    timestamp: now,
  })

  const clinics = await getClinics()
  await pushRoadmap(lineUserId, patient, clinics)
}

async function handlePostback(event: LineEvent) {
  const data = event.postback?.data ?? ''
  const lineUserId = event.source.userId
  const replyToken = event.replyToken ?? ''

  const params = new URLSearchParams(data)
  const action = params.get('action')
  const hn = params.get('hn')

  if (action === 'help' && hn) {
    const { getPatient } = await import('@/lib/sheets')
    const patient = await getPatient(hn)
    if (!patient) return

    const now = new Date().toISOString()
    patient.needHelp = true
    patient.updatedAt = now
    await upsertPatient(patient)

    const seq: string[] = JSON.parse(patient.sequenceJson || '[]')
    const currentClinicId = seq[patient.currentIndex] ?? ''

    await appendHelpRequest({
      helpId: crypto.randomUUID(),
      hn,
      clinicId: currentClinicId,
      status: 'OPEN',
      createdAt: now,
      resolvedAt: '',
    })

    await appendEvent({
      eventId: crypto.randomUUID(),
      hn,
      clinicId: currentClinicId,
      type: 'HELP_REQUESTED',
      timestamp: now,
    })

    await replyText(replyToken, 'ได้รับการแจ้งเตือนแล้ว เจ้าหน้าที่จะมาช่วยเหลือคุณในไม่ช้า / Help is on the way.')
  }
}
