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
    // ── Journey complete ──────────────────────────────────────────
    patient.status = 'COMPLETED'

    // Append completed event
    void appendEvent({ eventId: crypto.randomUUID(), hn, clinicId, type: 'COMPLETED', timestamp: now })

    // Push completion Flex — awaited so it reliably delivers
    if (patient.lineUserId) {
      try {
        await pushCompletion(patient.lineUserId, hn)
        void writeLog({ type: 'LINE_PUSH_SUCCESS', step: 'completion_flex', status: 'OK', hn })
      } catch (err) {
        void writeLog({ type: 'LINE_PUSH_FAILED', step: 'completion_flex', status: 'ERROR', hn, detail: String(err) })
      }
    }

    // Archive: copy to PatientHistory → delete from Patients
    try {
      await archivePatient(patient)
      void writeLog({ type: 'PATIENT_ARCHIVED', step: 'archive', status: 'OK', hn })
    } catch (err) {
      void writeLog({ type: 'ARCHIVE_ERROR', step: 'archive', status: 'ERROR', hn, detail: String(err) })
      await upsertPatient(patient)   // fallback: at least update status
    }
  } else {
    // ── Advance to next clinic ────────────────────────────────────
    patient.status = 'IN_PROGRESS'
    const nextClinic = sequence[patient.currentIndex]

    // Save patient + log events in parallel
    await Promise.all([
      upsertPatient(patient),
      appendEvent({ eventId: crypto.randomUUID(), hn, clinicId,   type: 'COMPLETED', timestamp: now }),
      appendEvent({ eventId: crypto.randomUUID(), hn, clinicId: nextClinic, type: 'ARRIVED', timestamp: now }),
    ])

    // Push updated roadmap Flex — awaited
    if (patient.lineUserId) {
      try {
        const clinics = await getClinics()   // served from cache after first load
        await pushRoadmap(patient.lineUserId, patient, clinics)
        void writeLog({ type: 'LINE_PUSH_SUCCESS', step: 'advance_roadmap', status: 'OK', hn })
      } catch (err) {
        void writeLog({ type: 'LINE_PUSH_FAILED', step: 'advance_roadmap', status: 'ERROR', hn, detail: String(err) })
      }
    }
  }

  return NextResponse.json({
    success: true,
    status: patient.status,
    currentIndex: patient.currentIndex,
    archived: isFinished,
  })
}
