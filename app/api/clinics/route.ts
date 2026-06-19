import { NextRequest, NextResponse } from 'next/server'
import { getClinics, upsertClinic, deleteClinic } from '@/lib/sheets'
import { invalidateClinics } from '@/lib/cache'
import { Clinic } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Pass ?nocache=1 to force a fresh fetch (bypasses 5-min in-process cache)
  if (req.nextUrl.searchParams.get('nocache') === '1') {
    invalidateClinics()
  }
  const clinics = await getClinics()
  return NextResponse.json(clinics)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const clinic: Clinic = {
    clinicId: body.clinicId || `clinic_${Date.now()}`,
    name: body.name,
    detail: body.detail ?? '',
    displayOrder: body.displayOrder ?? 0,
    active: body.active ?? true,
  }
  await upsertClinic(clinic)
  return NextResponse.json(clinic, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  if (!body.clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  if (body.clinicId === 'BILLING') {
    return NextResponse.json({ error: 'Cannot modify BILLING clinic' }, { status: 403 })
  }
  const clinic: Clinic = {
    clinicId: body.clinicId,
    name: body.name ?? '',
    detail: body.detail ?? '',
    displayOrder: body.displayOrder ?? 0,
    active: body.active ?? true,
  }
  await upsertClinic(clinic)
  return NextResponse.json(clinic)
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()
  if (!body.clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
  if (body.clinicId === 'BILLING') {
    return NextResponse.json({ error: 'Cannot delete BILLING clinic' }, { status: 403 })
  }
  await deleteClinic(body.clinicId)
  return NextResponse.json({ success: true })
}
