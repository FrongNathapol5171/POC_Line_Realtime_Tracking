import { NextRequest, NextResponse } from 'next/server'
import { getPatientByToken } from '@/lib/sheets'
import { buildDeepLink } from '@/lib/qr'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const token = params.token
  const result = await getPatientByToken(token)
  if (!result) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  }
  const deepLink = buildDeepLink(result.patient.hn, token)
  return NextResponse.redirect(deepLink, 302)
}
