import { NextRequest, NextResponse } from 'next/server'
import { getClinics, getPatient, upsertPatient, appendEvent } from '@/lib/sheets'
import { buildDeepLink, generateQrDataUrl } from '@/lib/qr'
import { Patient } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  const hn = req.nextUrl.searchParams.get('hn')

  // Lookup single patient by HN
  if (hn) {
    const patient = await getPatient(hn)
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    return NextResponse.json(patient)
  }

  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId or hn required' }, { status: 400 })
  }
  const { listPatientsAtClinic } = await import('@/lib/sheets')
  const patients = await listPatientsAtClinic(clinicId)
  return NextResponse.json(patients)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const hn: string = (body.hn ?? '').trim()
  const clinicIds: string[] = body.clinicIds ?? []

  if (!hn) return NextResponse.json({ error: 'HN is required' }, { status: 400 })
  if (!clinicIds.length) return NextResponse.json({ error: 'Select at least one clinic' }, { status: 400 })

  // Validate all selected clinics exist and are active
  const allClinics = await getClinics()
  const clinicMap = Object.fromEntries(allClinics.map(c => [c.clinicId, c]))
  for (const id of clinicIds) {
    if (!clinicMap[id] || !clinicMap[id].active) {
      return NextResponse.json({ error: `Invalid clinic: ${id}` }, { status: 400 })
    }
  }

  // Build sequence — append BILLING as mandatory last step
  const sequence = [...clinicIds.filter(id => id !== 'BILLING'), 'BILLING']

  const bindToken = crypto.randomUUID()
  const now = new Date().toISOString()

  const patient: Patient = {
    hn,
    lineUserId: '',
    bindToken,
    bindTokenUsed: false,
    sequenceJson: JSON.stringify(sequence),
    currentIndex: 0,
    status: 'REGISTERED',
    needHelp: false,
    createdAt: now,
    updatedAt: now,
  }

  await upsertPatient(patient)
  await appendEvent({
    eventId: crypto.randomUUID(),
    hn,
    clinicId: sequence[0],
    type: 'REGISTERED',
    timestamp: now,
  })

  const deepLink = buildDeepLink(hn, bindToken)
  const qrDataUrl = await generateQrDataUrl(deepLink)

  const sequenceDetails = sequence.map(id => ({
    clinicId: id,
    name: clinicMap[id]?.name ?? id,
    detail: clinicMap[id]?.detail ?? '',
  }))

  return NextResponse.json({ hn, qrDataUrl, deepLink, sequence: sequenceDetails })
}
