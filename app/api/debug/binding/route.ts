/**
 * Debug endpoint — simulates the LINE binding flow without LINE signature check.
 * Use this to test whether the token/patient lookup + Flex push works correctly.
 *
 * POST /api/debug/binding
 * Body: { "text": "ลงทะเบียนผู้ป่วย HN: HN003 | TOKEN: 02854bf3-...", "lineUserId": "Uxxxx" }
 *   OR
 * Body: { "hn": "HN003", "token": "02854bf3-...", "lineUserId": "Uxxxx" }
 *
 * Protected by ADMIN_ACCESS_CODE header: x-admin-code: <your code>
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getPatientByToken,
  updatePatientAtRow,
  appendEvent,
  getClinics,
} from '@/lib/sheets'
import { pushRoadmap, pushText } from '@/lib/line'
import { writeLog } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Gate with admin code
  const code = req.headers.get('x-admin-code') ?? ''
  if (code !== process.env.ADMIN_ACCESS_CODE) {
    return NextResponse.json({ error: 'Unauthorized — set x-admin-code header' }, { status: 401 })
  }

  const body = await req.json()
  const steps: Array<{ step: string; status: 'ok' | 'error' | 'skip'; detail: string }> = []

  // ── 1. Extract HN + TOKEN ────────────────────────────────────────
  let hn   = (body.hn   as string | undefined)?.trim() ?? ''
  let token = (body.token as string | undefined)?.trim() ?? ''
  const lineUserId = (body.lineUserId as string | undefined)?.trim() ?? 'U_DEBUG_TEST'

  if (!hn || !token) {
    // Try parsing from raw text
    const text: string = body.text ?? ''
    const tokenMatch = text.match(/TOKEN:\s*([a-f0-9A-F-]{36})/i)
    const hnMatch    = text.match(/HN:\s*([^\s|]+)/i)

    if (!tokenMatch || !hnMatch) {
      return NextResponse.json({
        error: 'Could not extract HN or TOKEN from text. Provide "hn"+"token" or "text" in body.',
        receivedText: text,
        regexResult: { tokenMatch: !!tokenMatch, hnMatch: !!hnMatch },
      }, { status: 400 })
    }
    token = tokenMatch[1].trim()
    hn    = hnMatch[1].trim()
  }

  steps.push({ step: '1_parse', status: 'ok', detail: `hn=${hn}  token=${token}  lineUserId=${lineUserId}` })

  // ── 2. Lookup token in Patients sheet ───────────────────────────
  let result: Awaited<ReturnType<typeof getPatientByToken>>
  try {
    result = await getPatientByToken(token)
  } catch (err) {
    steps.push({ step: '2_token_lookup', status: 'error', detail: `Sheets API error: ${err}` })
    return NextResponse.json({ steps, error: 'Sheets API failed on token lookup' }, { status: 500 })
  }

  if (!result) {
    steps.push({ step: '2_token_lookup', status: 'error', detail: `Token not found in Patients sheet. Token: ${token}` })
    return NextResponse.json({ steps, error: 'Token not found — check that registration completed and token matches the Patients sheet exactly.' }, { status: 404 })
  }

  const { patient, rowIndex } = result
  steps.push({ step: '2_token_lookup', status: 'ok', detail: `Patient found: hn=${patient.hn}  status=${patient.status}  bindTokenUsed=${patient.bindTokenUsed}  rowIndex=${rowIndex}` })

  // ── 3. Already bound? ────────────────────────────────────────────
  if (patient.bindTokenUsed) {
    steps.push({ step: '3_bind_check', status: 'skip', detail: `Already bound. lineUserId=${patient.lineUserId}` })
    return NextResponse.json({ steps, warning: 'Already bound — token is used. To re-test, manually set bindTokenUsed=FALSE in the sheet.' })
  }
  steps.push({ step: '3_bind_check', status: 'ok', detail: 'Token is unused — proceeding' })

  // ── 4. Update patient record ─────────────────────────────────────
  const now = new Date().toISOString()
  patient.lineUserId    = lineUserId
  patient.bindTokenUsed = true
  patient.status        = 'BOUND'
  patient.updatedAt     = now
  const firstClinicId = (JSON.parse(patient.sequenceJson) as string[])[0] ?? ''

  try {
    await Promise.all([
      updatePatientAtRow(rowIndex, patient),
      appendEvent({ eventId: crypto.randomUUID(), hn, clinicId: firstClinicId, type: 'BOUND', timestamp: now }),
    ])
    steps.push({ step: '4_save_patient', status: 'ok', detail: `Patient updated in sheet row ${rowIndex}` })
  } catch (err) {
    steps.push({ step: '4_save_patient', status: 'error', detail: String(err) })
    return NextResponse.json({ steps, error: 'Failed to save patient update' }, { status: 500 })
  }

  // ── 5. Load clinics ───────────────────────────────────────────────
  let clinics: Awaited<ReturnType<typeof getClinics>>
  try {
    clinics = await getClinics()
    steps.push({ step: '5_get_clinics', status: 'ok', detail: `${clinics.length} clinics loaded` })
  } catch (err) {
    steps.push({ step: '5_get_clinics', status: 'error', detail: String(err) })
    return NextResponse.json({ steps, error: 'Failed to load clinics' }, { status: 500 })
  }

  // ── 6. Push Flex roadmap ─────────────────────────────────────────
  if (lineUserId === 'U_DEBUG_TEST') {
    steps.push({ step: '6_push_roadmap', status: 'skip', detail: 'Skipped LINE push — no real lineUserId provided' })
  } else {
    try {
      const pushResult = await pushRoadmap(lineUserId, patient, clinics)
      steps.push({ step: '6_push_roadmap', status: 'ok', detail: `LINE push HTTP ${pushResult.status}` })
    } catch (err) {
      steps.push({ step: '6_push_roadmap', status: 'error', detail: `LINE API error: ${err}` })
    }
  }

  await writeLog({ type: 'DEBUG_BINDING', step: 'debug_test', status: 'OK', hn, detail: `via /api/debug/binding — lineUserId=${lineUserId}` })

  return NextResponse.json({ success: true, hn, token, steps })
}
