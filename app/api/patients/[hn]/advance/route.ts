import { NextRequest, NextResponse } from 'next/server'
import { getPatient, upsertPatient, appendEvent, getClinics, archivePatient } from '@/lib/sheets'
import { pushRoadmap, pushCompletion } from '@/lib/line'
import { writeLog } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { hn: string } },
) {
  const hn = params.hn
  const body = await req.json()
  const clinicId: string = body.clinicId ?? ''

  const patient = await getPatient(hn)
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const sequence: string[] = JSON.parse(patient.sequenceJson || '[]')
  const expectedClinic = sequence[patient.currentIndex]

  if (expectedClinic !== clinicId) {
    return NextResponse.json(
      { error: `Expected clinicId "${expectedClinic}" at index ${patient.currentIndex}, got "${clinicId}"` },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()
  patient.currentIndex++
  patient.updatedAt = now

  const isFinished = patient.currentIndex >= sequence.length

  if (isFinished) {
    // ── Journey complete ──────────────────────────────────────
    patient.status = 'COMPLETED'

    // 1. Log COMPLETED event + push LINE + archive — all in parallel
    await Promise.all([
      appendEvent({ eventId: crypto.randomUUID(), hn, clinicId, type: 'COMPLETED', timestamp: now }),
      patient.lineUserId
        ? pushCompletion(patient.lineUserId, hn).catch(async err => {
            await writeLog({ type: 'LINE_PUSH_FAILED', step: 'completion_flex', status: 'ERROR', hn, detail: String(err) })
          })
        : Promise.resolve(),
    ])

    // 2. Archive: copy to PatientHistory → delete from Patients
    try {
      await archivePatient(patient)
      await writeLog({ type: 'PATIENT_ARCHIVED', step: 'archive', status: 'OK', hn, detail: 'Moved to PatientHistory' })
    } catch (err) {
      // If archive fails, fall back to just updating status in-place so we don't lose data
      await writeLog({ type: 'ARCHIVE_ERROR', step: 'archive', status: 'ERROR', hn, detail: String(err) })
      await upsertPatient(patient)
    }
  } else {
    // ── Advance to next clinic ────────────────────────────────
    patient.status = 'IN_PROGRESS'
    const nextClinic = sequence[patient.currentIndex]

    // Parallelize: save patient + log both events + fetch clinics
    const [, , clinics] = await Promise.all([
      upsertPatient(patient),
      Promise.all([
        appendEvent({ eventId: crypto.randomUUID(), hn, clinicId, type: 'COMPLETED', timestamp: now }),
        appendEvent({ eventId: crypto.randomUUID(), hn, clinicId: nextClinic, type: 'ARRIVED', timestamp: now }),
      ]),
      patient.lineUserId ? getClinics() : Promise.resolve(null),
    ])

    if (patient.lineUserId && clinics) {
      pushRoadmap(patient.lineUserId, patient, clinics).catch(async err => {
        await writeLog({ type: 'LINE_PUSH_FAILED', step: 'advance_roadmap', status: 'ERROR', hn, detail: String(err) })
      })
    }
  }

  return NextResponse.json({ success: true, status: patient.status, currentIndex: patient.currentIndex, archived: isFinished })
}
