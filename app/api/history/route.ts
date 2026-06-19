import { NextResponse } from 'next/server'
import { getPatientHistory } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function GET() {
  const history = await getPatientHistory(200)
  return NextResponse.json(history)
}
