import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

// Expected tabs and their header rows
const TABS = [
  {
    name: 'Patients',
    headers: ['hn','lineUserId','bindToken','bindTokenUsed','sequenceJson','currentIndex','status','needHelp','createdAt','updatedAt'],
    seed: null,
  },
  {
    name: 'Clinics',
    headers: ['clinicId','name','detail','displayOrder','active'],
    seed: ['BILLING', 'Cashier / Billing', 'Pay at the cashier counter', '9999', 'TRUE'],
  },
  {
    name: 'Events',
    headers: ['eventId','hn','clinicId','type','timestamp'],
    seed: null,
  },
  {
    name: 'HelpRequests',
    headers: ['helpId','hn','clinicId','status','createdAt','resolvedAt'],
    seed: null,
  },
  {
    name: 'Logs',
    headers: ['logId','timestamp','type','hn','step','status','detail'],
    seed: null,
  },
  {
    name: 'PatientHistory',
    headers: ['hn','lineUserId','bindToken','bindTokenUsed','sequenceJson','currentIndex','status','needHelp','createdAt','updatedAt','completedAt'],
    seed: null,
  },
]

function getAuth() {
  return new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    undefined,
    (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets'],
  )
}

export async function POST(req: NextRequest) {
  // Protect with admin code
  const body = await req.json().catch(() => ({}))
  const code = body.code ?? req.headers.get('x-admin-code') ?? ''
  if (code !== process.env.ADMIN_ACCESS_CODE) {
    return NextResponse.json({ error: 'Unauthorized — provide correct ADMIN_ACCESS_CODE' }, { status: 401 })
  }

  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!
  const results: string[] = []

  // 1. Get existing sheet names
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const existing = (meta.data.sheets ?? []).map(s => s.properties?.title ?? '')

  // 2. Create missing sheets in one batchUpdate
  const toCreate = TABS.filter(t => !existing.includes(t.name))
  if (toCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: toCreate.map(t => ({
          addSheet: { properties: { title: t.name } },
        })),
      },
    })
    results.push(`Created sheets: ${toCreate.map(t => t.name).join(', ')}`)
  } else {
    results.push('All sheets already exist')
  }

  // 3. Write headers + seed rows for each tab
  for (const tab of TABS) {
    // Check if the sheet already has data
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab.name}!A1:A2`,
    })
    const rows = res.data.values ?? []

    if (rows.length === 0) {
      // Empty — write headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab.name}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [tab.headers] },
      })
      results.push(`${tab.name}: headers written`)

      // Write seed row if any
      if (tab.seed) {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${tab.name}!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [tab.seed] },
        })
        results.push(`${tab.name}: seed row added`)
      }
    } else {
      results.push(`${tab.name}: already has data, skipped`)
    }
  }

  return NextResponse.json({
    success: true,
    spreadsheetId,
    results,
    message: 'Google Sheet initialized. Run this endpoint once only.',
  })
}

export async function GET(req: NextRequest) {
  // Allow GET with ?code= for browser convenience
  const code = req.nextUrl.searchParams.get('code') ?? ''
  if (code !== process.env.ADMIN_ACCESS_CODE) {
    return NextResponse.json({ error: 'Pass ?code=ADMIN_ACCESS_CODE to initialize the sheet' }, { status: 401 })
  }

  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!
  const results: string[] = []

  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const existing = (meta.data.sheets ?? []).map(s => s.properties?.title ?? '')

  const toCreate = TABS.filter(t => !existing.includes(t.name))
  if (toCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: toCreate.map(t => ({ addSheet: { properties: { title: t.name } } })),
      },
    })
    results.push(`Created: ${toCreate.map(t => t.name).join(', ')}`)
  }

  for (const tab of TABS) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `${tab.name}!A1:A2`,
    })
    const rows = res.data.values ?? []
    if (rows.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `${tab.name}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [tab.headers] },
      })
      results.push(`${tab.name}: headers written`)
      if (tab.seed) {
        await sheets.spreadsheets.values.append({
          spreadsheetId, range: `${tab.name}!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [tab.seed] },
        })
        results.push(`${tab.name}: seed row added`)
      }
    } else {
      results.push(`${tab.name}: already has data`)
    }
  }

  return NextResponse.json({ success: true, spreadsheetId, results })
}
