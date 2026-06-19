import { NextRequest, NextResponse } from 'next/server'
import { resolveHelpRequest, getPatient, upsertPatient } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const helpId: string = body.helpId ?? ''
  if (!helpId) return NextResponse.json({ error: 'helpId required' }, { status: 400 })

  const resolved = await resolveHelpRequest(helpId)
  if (!resolved) return NextResponse.json({ error: 'HelpRequest not found' }, { status: 404 })

  // Clear needHelp flag on patient
  const patient = await getPatient(resolved.hn)
  if (patient) {
    patient.needHelp = false
    patient.updatedAt = new Date().toISOString()
    await upsertPatient(patient)
  }

  return NextResponse.json({ success: true })
}
