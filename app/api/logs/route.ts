import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

function getAuth() {
  return new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    undefined,
    (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets'],
  )
}

export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '100', 10)

  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID!,
      range: 'Logs!A:G',
    })

    const rows = res.data.values ?? []
    if (rows.length <= 1) return NextResponse.json([])

    const headers = rows[0] as string[]
    const data = rows
      .slice(1)
      .map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])))
      .reverse()      // newest first
      .slice(0, limit)

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE() {
  // Clear all logs except header
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const spreadsheetId = process.env.GOOGLE_SHEET_ID!

    // Get sheet id for Logs tab
    const meta = await sheets.spreadsheets.get({ spreadsheetId })
    const logsSheet = meta.data.sheets?.find(s => s.properties?.title === 'Logs')
    if (!logsSheet?.properties?.sheetId) return NextResponse.json({ error: 'Logs sheet not found' }, { status: 404 })

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: logsSheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: 1,   // keep header (row 0)
              endIndex: 10000,
            },
          },
        }],
      },
    })

    return NextResponse.json({ success: true, message: 'Logs cleared (header preserved)' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
