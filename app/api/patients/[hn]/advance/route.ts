import { NextRequest, NextResponse } from 'next/server'
import { getPatient, upsertPatient, appendEvent, getClinics } from '@/lib/sheets'
import { pushRoadmap, pushCompletion } from '@/lib/line'

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
      { error: `Expected clinicId ${expectedClinic} but got ${clinicId}` },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()

  // Log COMPLETED event for current clinic
  await appendEvent({
    eventId: crypto.randomUUID(),
    hn,
    clinicId,
    type: 'COMPLETED',
    timestamp: now,
  })

  patient.currentIndex++
  patient.updatedAt = now

  const isFinished = patient.currentIndex >= sequence.length

  if (isFinished) {
    patient.status = 'COMPLETED'
    await upsertPatient(patient)
    if (patient.lineUserId) {
      await pushCompletion(patient.lineUserId, hn)
    }
  } else {
    patient.status = 'IN_PROGRESS'
    await upsertPatient(patient)

    // Log ARRIVED event for next clinic
    const nextClinic = sequence[patient.currentIndex]
    await appendEvent({
      eventId: crypto.randomUUID(),
      hn,
      clinicId: nextClinic,
      type: 'ARRIVED',
      timestamp: now,
    })

    if (patient.lineUserId) {
      const clinics = await getClinics()
      await pushRoadmap(patient.lineUserId, patient, clinics)
    }
  }

  return NextResponse.json({ success: true, status: patient.status, currentIndex: patient.currentIndex })
}
