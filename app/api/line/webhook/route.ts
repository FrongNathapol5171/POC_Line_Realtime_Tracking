import { NextRequest, NextResponse } from 'next/server'
import {
  getPatientByToken,
  getPatient,
  upsertPatient,
  updatePatientAtRow,
  appendEvent,
  appendHelpRequest,
  getClinics,
} from '@/lib/sheets'
import { validateLineSignature, pushRoadmap, pushText, replyText } from '@/lib/line'
import { writeLog } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Entry point — LINE calls this on every chat event
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  // 1. Verify LINE signature
  if (!validateLineSignature(rawBody, signature)) {
    await writeLog({ type: 'WEBHOOK_ERROR', step: 'signature_check', status: 'ERROR', detail: 'Invalid x-line-signature' })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let body: { events?: LineEvent[] }
  try {
    body = JSON.parse(rawBody)
  } catch {
    await writeLog({ type: 'WEBHOOK_ERROR', step: 'parse_body', status: 'ERROR', detail: 'Could not parse JSON body' })
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }

  const events: LineEvent[] = body.events ?? []

  await writeLog({
    type: 'WEBHOOK_RECEIVED',
    step: 'received',
    status: 'INFO',
    detail: `${events.length} event(s) — types: ${events.map(e => e.type).join(', ')}`,
  })

  // 2. Respond 200 immediately (LINE times out after ~1s)
  //    Process events async — but now every step is logged to Sheets
  processEvents(events).catch(async (err) => {
    await writeLog({
      type: 'PROCESS_ERROR', step: 'processEvents', status: 'ERROR',
      detail: String(err),
    })
  })

  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LineEvent = {
  type: string
  replyToken?: string
  source: { userId: string }
  message?: { type: string; text: string }
  postback?: { data: string }
}

// ---------------------------------------------------------------------------
// Event router
// ---------------------------------------------------------------------------

async function processEvents(events: LineEvent[]) {
  for (const event of events) {
    if (event.type === 'message' && event.message?.type === 'text') {
      await handleBindingMessage(event)
    } else if (event.type === 'postback') {
      await handlePostback(event)
    } else {
      await writeLog({
        type: 'WEBHOOK_SKIP', step: 'event_type', status: 'INFO',
        detail: `Ignored event type: ${event.type}`,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Binding: patient sends the pre-filled message from scanning the QR
// ---------------------------------------------------------------------------

async function handleBindingMessage(event: LineEvent) {
  const text = event.message?.text ?? ''
  const lineUserId = event.source.userId
  const replyToken = event.replyToken ?? ''

  await writeLog({
    type: 'BINDING_ATTEMPT', step: 'parse_message', status: 'INFO',
    detail: `userId=${lineUserId} | text="${text.slice(0, 120)}"`,
  })

  // Parse "HN: XXX | TOKEN: yyy" from message
  const tokenMatch = text.match(/TOKEN:\s*([a-f0-9-]{36})/i)
  const hnMatch    = text.match(/HN:\s*([^\s|]+)/i)

  if (!tokenMatch || !hnMatch) {
    await writeLog({
      type: 'BINDING_SKIP', step: 'parse_message', status: 'WARN',
      detail: `No HN/TOKEN pattern in message. text="${text.slice(0, 200)}"`,
    })
    return   // not a binding message — ignore silently
  }

  const token = tokenMatch[1].trim()
  const hn    = hnMatch[1].trim()

  await writeLog({ type: 'BINDING_ATTEMPT', step: 'token_extracted', status: 'INFO', hn, detail: `token=${token}` })

  // Lookup patient by token
  let result: Awaited<ReturnType<typeof getPatientByToken>>
  try {
    result = await getPatientByToken(token)
  } catch (err) {
    await writeLog({ type: 'BINDING_ERROR', step: 'getPatientByToken', status: 'ERROR', hn, detail: String(err) })
    await safePushText(lineUserId, 'System error — please contact staff. (DB lookup failed)')
    return
  }

  if (!result) {
    await writeLog({ type: 'BINDING_ERROR', step: 'token_lookup', status: 'WARN', hn, detail: `Token not found: ${token}` })
    await safePushText(lineUserId, `Registration not found (HN: ${hn}). Please contact staff.`)
    return
  }

  const { patient } = result

  // Already bound — idempotent
  if (patient.bindTokenUsed) {
    await writeLog({ type: 'BINDING_SKIP', step: 'already_bound', status: 'WARN', hn, detail: `lineUserId already=${patient.lineUserId}` })
    await safePushText(lineUserId, 'This account is already linked. / บัญชีนี้เชื่อมต่อแล้ว')
    return
  }

  // Bind: update patient record
  const now = new Date().toISOString()
  patient.lineUserId    = lineUserId
  patient.bindTokenUsed = true
  patient.status        = 'BOUND'
  patient.updatedAt     = now

  const firstClinicId = (JSON.parse(patient.sequenceJson) as string[])[0] ?? ''

  // ── PARALLEL: direct row update (no re-read) + log event + cached clinics ──
  // updatePatientAtRow uses the rowIndex already known from getPatientByToken.
  // This skips a full sheet re-read that upsertPatient() would trigger.
  let clinics: Awaited<ReturnType<typeof getClinics>>
  try {
    const [, , fetchedClinics] = await Promise.all([
      updatePatientAtRow(result.rowIndex, patient),   // direct write — no extra read
      appendEvent({ eventId: crypto.randomUUID(), hn, clinicId: firstClinicId, type: 'BOUND', timestamp: now }),
      getClinics(),                                    // served from cache if warm
    ])
    clinics = fetchedClinics
    await writeLog({ type: 'BINDING_SUCCESS', step: 'parallel_save+clinics', status: 'OK', hn, detail: `${clinics.length} clinics, lineUserId=${lineUserId}` })
  } catch (err) {
    await writeLog({ type: 'BINDING_ERROR', step: 'parallel_save+clinics', status: 'ERROR', hn, detail: String(err) })
    await safePushText(lineUserId, 'System error — binding may have failed. Please contact staff.')
    return
  }

  // Push roadmap Flex message
  try {
    const pushResult = await pushRoadmap(lineUserId, patient, clinics)
    await writeLog({
      type: 'LINE_PUSH_SUCCESS', step: 'push_roadmap', status: 'OK', hn,
      detail: `HTTP ${pushResult.status}`,
    })
  } catch (err) {
    await writeLog({ type: 'LINE_PUSH_FAILED', step: 'push_roadmap', status: 'ERROR', hn, detail: String(err) })
    // Binding is saved — patient IS bound even if Flex failed
    await safePushText(lineUserId, `Linked! (HN: ${hn}) — Your journey has started. Ask staff for the clinic roadmap if it does not appear.`)
  }
}

// ---------------------------------------------------------------------------
// Postback: "Need Help" button in Flex message
// ---------------------------------------------------------------------------

async function handlePostback(event: LineEvent) {
  const data      = event.postback?.data ?? ''
  const lineUserId = event.source.userId
  const replyToken = event.replyToken ?? ''

  const params = new URLSearchParams(data)
  const action = params.get('action')
  const hn     = params.get('hn') ?? ''

  await writeLog({ type: 'POSTBACK', step: 'received', status: 'INFO', hn, detail: `action=${action}` })

  if (action !== 'help' || !hn) return

  try {
    const patient = await getPatient(hn)
    if (!patient) {
      await writeLog({ type: 'POSTBACK_ERROR', step: 'get_patient', status: 'WARN', hn, detail: 'Patient not found' })
      return
    }

    const now = new Date().toISOString()
    patient.needHelp  = true
    patient.updatedAt = now
    await upsertPatient(patient)

    const seq            = JSON.parse(patient.sequenceJson || '[]') as string[]
    const currentClinicId = seq[patient.currentIndex] ?? ''

    await appendHelpRequest({ helpId: crypto.randomUUID(), hn, clinicId: currentClinicId, status: 'OPEN', createdAt: now, resolvedAt: '' })
    await appendEvent({ eventId: crypto.randomUUID(), hn, clinicId: currentClinicId, type: 'HELP_REQUESTED', timestamp: now })

    await writeLog({ type: 'HELP_LOGGED', step: 'postback_help', status: 'OK', hn, detail: `clinic=${currentClinicId}` })

    try {
      await replyText(replyToken, 'Help is on the way. Staff have been notified. / เจ้าหน้าที่รับทราบแล้ว กรุณารอสักครู่')
      await writeLog({ type: 'LINE_REPLY_SUCCESS', step: 'reply_help_ack', status: 'OK', hn })
    } catch (err) {
      await writeLog({ type: 'LINE_REPLY_FAILED', step: 'reply_help_ack', status: 'ERROR', hn, detail: String(err) })
    }
  } catch (err) {
    await writeLog({ type: 'POSTBACK_ERROR', step: 'handle_help', status: 'ERROR', hn, detail: String(err) })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Push a plain-text fallback — logs but never throws */
async function safePushText(lineUserId: string, text: string) {
  try {
    await pushText(lineUserId, text)
    await writeLog({ type: 'LINE_PUSH_SUCCESS', step: 'safe_push_text', status: 'OK', detail: `to=${lineUserId}` })
  } catch (err) {
    await writeLog({ type: 'LINE_PUSH_FAILED', step: 'safe_push_text', status: 'ERROR', detail: String(err) })
  }
}
