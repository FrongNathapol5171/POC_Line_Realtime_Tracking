/**
 * Writes a structured log row to the Google Sheets "Logs" tab.
 * Fire-and-forget — never throws so it cannot break the calling flow.
 *
 * Sheet columns:
 *   logId | timestamp | type | hn | step | status | detail
 */

import { google } from 'googleapis'

export type LogStatus = 'OK' | 'ERROR' | 'WARN' | 'INFO'

export interface LogEntry {
  type: string     // e.g. BINDING_SUCCESS, LINE_PUSH_FAILED
  hn?: string
  step: string     // which part of the process
  status: LogStatus
  detail?: string  // response body, error message, etc.
}

const HEADERS = ['logId', 'timestamp', 'type', 'hn', 'step', 'status', 'detail']

function getAuth() {
  return new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    undefined,
    (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets'],
  )
}

export async function writeLog(entry: LogEntry): Promise<void> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const spreadsheetId = process.env.GOOGLE_SHEET_ID!

    // Seed header row if sheet is empty
    const check = await sheets.spreadsheets.values.get({
      spreadsheetId, range: 'Logs!A1:A1',
    })
    if (!check.data.values?.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: 'Logs!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [HEADERS] },
      })
    }

    const row = [
      crypto.randomUUID(),
      new Date().toISOString(),
      entry.type,
      entry.hn ?? '',
      entry.step,
      entry.status,
      (entry.detail ?? '').slice(0, 800),
    ]

    await sheets.spreadsheets.values.append({
      spreadsheetId, range: 'Logs!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [row] },
    })
  } catch (err) {
    // Logger itself must never crash the caller
    console.error('[logger] Sheet write failed:', err)
  }
}
