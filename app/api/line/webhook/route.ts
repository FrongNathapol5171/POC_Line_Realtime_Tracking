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
// Entry point
// Strategy:
//   • Respond 200 as fast as possible (LINE requires < 1s)
//   • CRITICAL writes (lineUserId update) → awaited BEFORE responding
//   • LINE push (Flex message) → fire-and-forget AFTER responding
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  // Verify signature
  if (!validateLineSignature(rawBody, signature)) {
    void writeLog({ type: 'WEBHOOK_ERROR', step: 'signature_check', status: 'ERROR', detail: 'Invalid x-line-signature' })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let body: { events?: LineEvent[] }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }

  const events: LineEvent[] = body.events ?? []

  // Log receipt (fire-and-forget — don't await, keep response fast)
  void writeLog({
    type: 'WEBHOOK_RECEIVED', step: 'received', status: 'INFO',
    detail: `${events.length} event(s): ${events.map(e => e.type).join(', ')}`,
  })

  // Process synchronously so sheet writes complete before response.
  // LINE push is done inside as fire-and-forget (non-blocking).
  try {
    await processEvents(events)
  } catch (err) {
    void writeLog({ type: 'PROCESS_ERROR', step: 'processEvents', status: 'ERROR', detail: String(err) })
    // Still return 200 so LINE doesn't retry (idempotency handles duplicates)
  }

  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Binding — patient sends pre-filled message after scanning QR
// ---------------------------------------------------------------------------

async function handleBindingMessage(event: LineEvent) {
  const rawText   = event.message?.text ?? ''
  const lineUserId = event.source.userId
  const replyToken = event.replyToken ?? ''

  // Normalise: collapse whitespace, trim
  const text = rawText.replace(/\s+/g, ' ').trim()

  void writeLog({
    type: 'BINDING_ATTEMPT', step: 'parse_message', status: 'INFO',
    detail: `userId=${lineUserId} text="${text.slice(0, 150)}"`,
  })

  // Permissive UUID regex — allows any case, trims surrounding whitespace
  const tokenMatch = text.match(/TOKEN\s*:\s*([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/i)
  const hnMatch    = text.match(/HN\s*:\s*([^\s|]+)/i)

  if (!tokenMatch || !hnMatch) {
    void writeLog({
      type: 'BINDING_SKIP', step: 'parse_message', status: 'WARN',
      detail: `No HN/TOKEN pattern. text="${text.slice(0, 200)}"`,
    })
    return
  }

  const token = tokenMatch[1].trim().toLowerCase()
  const hn    = hnMatch[1].trim()

  void writeLog({ type: 'BINDING_ATTEMPT', step: 'token_extracted', status: 'INFO', hn, detail: `token=${token}` })

  // ── Token lookup (must succeed before sheet write) ───────────────
  let result: Awaited<ReturnType<typeof getPatientByToken>>
  try {
    result = await getPatientByToken(token)
  } catch (err) {
    void writeLog({ type: 'BINDING_ERROR', step: 'getPatientByToken', status: 'ERROR', hn, detail: String(err) })
    void safePushText(lineUserId, 'System error during lookup — please contact staff.')
    return
  }

  if (!result) {
    void writeLog({ type: 'BINDING_ERROR', step: 'token_lookup', status: 'WARN', hn, detail: `Token not found: ${token}` })
    void safePushText(lineUserId, `Registration not found (HN: ${hn}). Please contact staff. / ไม่พบข้อมูล`)
    return
  }

  const { patient, rowIndex } = result

  // Idempotent — already bound
  if (patient.bindTokenUsed) {
    void writeLog({ type: 'BINDING_SKIP', step: 'already_bound', status: 'WARN', hn, detail: `lineUserId=${patient.lineUserId}` })
    void safePushText(lineUserId, 'Account already linked. / บัญชีนี้เชื่อมต่อแล้ว')
    return
  }

  // ── CRITICAL: write lineUserId to sheet (awaited — must complete) ──
  const now = new Date().toISOString()
  patient.lineUserId    = lineUserId
  patient.bindTokenUsed = true
  patient.status        = 'BOUND'
  patient.updatedAt     = now
  const firstClinicId = (JSON.parse(patient.sequenceJson) as string[])[0] ?? ''

  try {
    // updatePatientAtRow uses known rowIndex — no extra sheet read needed
    await updatePatientAtRow(rowIndex, patient)
    void writeLog({ type: 'BINDING_SUCCESS', step: 'sheet_update', status: 'OK', hn, detail: `lineUserId=${lineUserId} row=${rowIndex}` })
  } catch (err) {
    void writeLog({ type: 'BINDING_ERROR', step: 'sheet_update', status: 'ERROR', hn, detail: String(err) })
    void safePushText(lineUserId, 'System error saving your data — please try again or contact staff.')
    return
  }

  // ── Parallel: fetch clinics + append event at the same time ────────
  // getClinics() is served from cache after first call (~0ms warm)
  let clinics: Awaited<ReturnType<typeof getClinics>>
  try {
    const [fetchedClinics] = await Promise.all([
      getClinics(),
      // appendEvent is non-critical — run in parallel, errors are logged
      appendEvent({ eventId: crypto.randomUUID(), hn, clinicId: firstClinicId, type: 'BOUND', timestamp: now })
        .catch(err => writeLog({ type: 'BINDING_ERROR', step: 'append_event', status: 'ERROR', hn, detail: String(err) })),
    ])
    clinics = fetchedClinics
  } catch (err) {
    void writeLog({ type: 'BINDING_ERROR', step: 'get_clinics', status: 'ERROR', hn, detail: String(err) })
    return   // can't push roadmap without clinics
  }

  // ── Push Flex roadmap — AWAITED so it always completes ──────────────
  try {
    const pushResult = await pushRoadmap(lineUserId, patient, clinics)
    void writeLog({ type: 'LINE_PUSH_SUCCESS', step: 'push_roadmap', status: 'OK', hn, detail: `HTTP ${pushResult.status}` })
  } catch (err) {
    void writeLog({ type: 'LINE_PUSH_FAILED', step: 'push_roadmap', status: 'ERROR', hn, detail: String(err) })
    // Push failed — log only, no text fallback (avoids confusion of seeing
    // text msg before flex, making user think they need to send again)
  }
}

// ---------------------------------------------------------------------------
// Postback — "Need Help" button
// ---------------------------------------------------------------------------

async function handlePostback(event: LineEvent) {
  const data       = event.postback?.data ?? ''
  const lineUserId  = event.source.userId
  const replyToken  = event.replyToken ?? ''

  const params = new URLSearchParams(data)
  const action = params.get('action')
  const hn     = params.get('hn') ?? ''

  if (action !== 'help' || !hn) return

  try {
    const patient = await getPatient(hn)
    if (!patient) return

    const now = new Date().toISOString()
    patient.needHelp  = true
    patient.updatedAt = now
    await upsertPatient(patient)

    const seq             = JSON.parse(patient.sequenceJson || '[]') as string[]
    const currentClinicId = seq[patient.currentIndex] ?? ''

    await Promise.all([
      appendHelpRequest({ helpId: crypto.randomUUID(), hn, clinicId: currentClinicId, status: 'OPEN', createdAt: now, resolvedAt: '' }),
      appendEvent({ eventId: crypto.randomUUID(), hn, clinicId: currentClinicId, type: 'HELP_REQUESTED', timestamp: now }),
    ])

    void writeLog({ type: 'HELP_LOGGED', step: 'postback_help', status: 'OK', hn })

    try {
      await replyText(replyToken, 'Help is on the way. / เจ้าหน้าที่รับทราบแล้ว กรุณารอสักครู่')
    } catch (err) {
      void writeLog({ type: 'LINE_REPLY_FAILED', step: 'reply_help', status: 'ERROR', hn, detail: String(err) })
    }
  } catch (err) {
    void writeLog({ type: 'POSTBACK_ERROR', step: 'handle_help', status: 'ERROR', hn, detail: String(err) })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function safePushText(lineUserId: string, text: string) {
  try {
    await pushText(lineUserId, text)
  } catch (err) {
    void writeLog({ type: 'LINE_PUSH_FAILED', step: 'safe_push_text', status: 'ERROR', detail: String(err) })
  }
}
