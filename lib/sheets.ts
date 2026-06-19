import { google } from 'googleapis'
import {
  Patient,
  Clinic,
  PatientEvent,
  HelpRequest,
  PatientStatus,
  EventType,
  DashboardData,
} from './types'
import { getCachedClinics, setCachedClinics, invalidateClinics, getCachedSheetId, setCachedSheetId } from './cache'

// ---------------------------------------------------------------------------
// Auth — cached per process to avoid recreating JWT on every call
// ---------------------------------------------------------------------------

let _authClient: InstanceType<typeof google.auth.JWT> | null = null

function getAuth() {
  if (_authClient) return _authClient
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!
  const key = (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')
  _authClient = new google.auth.JWT(email, undefined, key, [
    'https://www.googleapis.com/auth/spreadsheets',
  ])
  return _authClient
}

let _sheetsClient: ReturnType<typeof google.sheets> | null = null

function getSheets() {
  if (_sheetsClient) return _sheetsClient
  _sheetsClient = google.sheets({ version: 'v4', auth: getAuth() })
  return _sheetsClient
}

const SHEET_ID = () => process.env.GOOGLE_SHEET_ID!

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

async function getSheetValues(tab: string): Promise<string[][]> {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `${tab}!A:Z`,
  })
  return (res.data.values ?? []) as string[][]
}

async function appendRow(tab: string, values: (string | number | boolean)[]) {
  const sheets = getSheets()
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: `${tab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [values.map(String)] },
  })
}

async function updateRow(
  tab: string,
  rowIndex: number,   // 1-based (1 = header row)
  values: (string | number | boolean)[],
) {
  const sheets = getSheets()
  const range = `${tab}!A${rowIndex}:Z${rowIndex}`
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [values.map(String)] },
  })
}

// ---------------------------------------------------------------------------
// Patients tab
// Columns: hn | lineUserId | bindToken | bindTokenUsed | sequenceJson |
//          currentIndex | status | needHelp | createdAt | updatedAt
// ---------------------------------------------------------------------------

const P_HEADERS = [
  'hn','lineUserId','bindToken','bindTokenUsed','sequenceJson',
  'currentIndex','status','needHelp','createdAt','updatedAt',
]

function rowToPatient(row: string[]): Patient {
  return {
    hn: row[0] ?? '',
    lineUserId: row[1] ?? '',
    bindToken: row[2] ?? '',
    bindTokenUsed: row[3] === 'TRUE',
    sequenceJson: row[4] ?? '[]',
    currentIndex: parseInt(row[5] ?? '0', 10),
    status: (row[6] ?? 'REGISTERED') as PatientStatus,
    needHelp: row[7] === 'TRUE',
    createdAt: row[8] ?? '',
    updatedAt: row[9] ?? '',
  }
}

function patientToRow(p: Patient): string[] {
  return [
    p.hn,
    p.lineUserId,
    p.bindToken,
    p.bindTokenUsed ? 'TRUE' : 'FALSE',
    p.sequenceJson,
    String(p.currentIndex),
    p.status,
    p.needHelp ? 'TRUE' : 'FALSE',
    p.createdAt,
    p.updatedAt,
  ]
}

export async function getPatient(hn: string): Promise<Patient | null> {
  const rows = await getSheetValues('Patients')
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === hn) return rowToPatient(rows[i])
  }
  return null
}

export async function getPatientByToken(token: string): Promise<{ patient: Patient; rowIndex: number } | null> {
  const rows = await getSheetValues('Patients')
  const normalised = token.trim().toLowerCase()
  for (let i = 1; i < rows.length; i++) {
    const stored = (rows[i][2] ?? '').trim().toLowerCase()
    if (stored === normalised) return { patient: rowToPatient(rows[i]), rowIndex: i + 1 }
  }
  return null
}

/**
 * Update a patient row directly by its known 1-based row index.
 * Faster than upsertPatient() because it skips re-reading the whole sheet.
 */
export async function updatePatientAtRow(rowIndex: number, patient: Patient): Promise<void> {
  await updateRow('Patients', rowIndex, patientToRow(patient))
}

export async function upsertPatient(patient: Patient): Promise<void> {
  const rows = await getSheetValues('Patients')
  if (rows.length === 0) {
    await appendRow('Patients', P_HEADERS)
    await appendRow('Patients', patientToRow(patient))
    return
  }
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === patient.hn) {
      await updateRow('Patients', i + 1, patientToRow(patient))
      return
    }
  }
  await appendRow('Patients', patientToRow(patient))
}

export async function listPatientsAtClinic(clinicId: string): Promise<Patient[]> {
  const rows = await getSheetValues('Patients')
  const result: Patient[] = []
  for (let i = 1; i < rows.length; i++) {
    const p = rowToPatient(rows[i])
    if (p.status === 'COMPLETED') continue
    const seq: string[] = JSON.parse(p.sequenceJson || '[]')
    if (seq[p.currentIndex] === clinicId) result.push(p)
  }
  return result
}

// ---------------------------------------------------------------------------
// Clinics tab
// Columns: clinicId | name | detail | displayOrder | active
// ---------------------------------------------------------------------------

const C_HEADERS = ['clinicId','name','detail','displayOrder','active']

const BILLING_SEED: Clinic = {
  clinicId: 'BILLING',
  name: 'ชำระเงิน / Cashier',
  detail: 'กรุณาชำระเงินที่เคาน์เตอร์การเงิน',
  displayOrder: 9999,
  active: true,
}

function rowToClinic(row: string[]): Clinic {
  return {
    clinicId: row[0] ?? '',
    name: row[1] ?? '',
    detail: row[2] ?? '',
    displayOrder: parseInt(row[3] ?? '0', 10),
    active: row[4] !== 'FALSE',
  }
}

function clinicToRow(c: Clinic): string[] {
  return [
    c.clinicId,
    c.name,
    c.detail,
    String(c.displayOrder),
    c.active ? 'TRUE' : 'FALSE',
  ]
}

export async function getClinics(): Promise<Clinic[]> {
  // Check in-memory cache first (saves ~500ms Sheets API call)
  const cached = getCachedClinics()
  if (cached) return cached

  const rows = await getSheetValues('Clinics')
  if (rows.length <= 1) await seedBilling(rows.length === 0)
  const freshRows = rows.length > 1 ? rows : await getSheetValues('Clinics')
  const clinics = freshRows.slice(1).map(rowToClinic).filter(c => c.clinicId)
  const hasBilling = clinics.some(c => c.clinicId === 'BILLING')
  if (!hasBilling) {
    await appendRow('Clinics', clinicToRow(BILLING_SEED))
    clinics.push(BILLING_SEED)
  }
  const sorted = clinics.sort((a, b) => a.displayOrder - b.displayOrder)
  setCachedClinics(sorted)
  return sorted
}

async function seedBilling(needsHeader: boolean) {
  if (needsHeader) await appendRow('Clinics', C_HEADERS)
  await appendRow('Clinics', clinicToRow(BILLING_SEED))
}

export async function upsertClinic(clinic: Clinic): Promise<void> {
  invalidateClinics()   // force cache refresh on next getClinics() call
  const rows = await getSheetValues('Clinics')
  if (rows.length === 0) {
    await appendRow('Clinics', C_HEADERS)
    await appendRow('Clinics', clinicToRow(clinic))
    return
  }
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === clinic.clinicId) {
      await updateRow('Clinics', i + 1, clinicToRow(clinic))
      return
    }
  }
  await appendRow('Clinics', clinicToRow(clinic))
}

export async function deleteClinic(clinicId: string): Promise<void> {
  if (clinicId === 'BILLING') throw new Error('Cannot delete BILLING clinic')
  const sheets = getSheets()
  const rows = await getSheetValues('Clinics')
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === clinicId) {
      // Mark inactive instead of deleting rows (simpler for Sheets)
      const clinic = rowToClinic(rows[i])
      clinic.active = false
      await updateRow('Clinics', i + 1, clinicToRow(clinic))
      return
    }
  }
  void sheets // keep import used
}

// ---------------------------------------------------------------------------
// Events tab
// Columns: eventId | hn | clinicId | type | timestamp
// ---------------------------------------------------------------------------

const E_HEADERS = ['eventId','hn','clinicId','type','timestamp']

function rowToEvent(row: string[]): PatientEvent {
  return {
    eventId: row[0] ?? '',
    hn: row[1] ?? '',
    clinicId: row[2] ?? '',
    type: (row[3] ?? 'REGISTERED') as EventType,
    timestamp: row[4] ?? '',
  }
}

export async function appendEvent(event: PatientEvent): Promise<void> {
  const rows = await getSheetValues('Events')
  if (rows.length === 0) await appendRow('Events', E_HEADERS)
  await appendRow('Events', [
    event.eventId,
    event.hn,
    event.clinicId,
    event.type,
    event.timestamp,
  ])
}

async function getAllEvents(): Promise<PatientEvent[]> {
  const rows = await getSheetValues('Events')
  return rows.slice(1).map(rowToEvent).filter(e => e.eventId)
}

// ---------------------------------------------------------------------------
// HelpRequests tab
// Columns: helpId | hn | clinicId | status | createdAt | resolvedAt
// ---------------------------------------------------------------------------

const H_HEADERS = ['helpId','hn','clinicId','status','createdAt','resolvedAt']

function rowToHelp(row: string[]): HelpRequest {
  return {
    helpId: row[0] ?? '',
    hn: row[1] ?? '',
    clinicId: row[2] ?? '',
    status: (row[3] ?? 'OPEN') as 'OPEN' | 'RESOLVED',
    createdAt: row[4] ?? '',
    resolvedAt: row[5] ?? '',
  }
}

function helpToRow(h: HelpRequest): string[] {
  return [h.helpId, h.hn, h.clinicId, h.status, h.createdAt, h.resolvedAt]
}

export async function appendHelpRequest(help: HelpRequest): Promise<void> {
  const rows = await getSheetValues('HelpRequests')
  if (rows.length === 0) await appendRow('HelpRequests', H_HEADERS)
  await appendRow('HelpRequests', helpToRow(help))
}

export async function getOpenHelpRequests(): Promise<HelpRequest[]> {
  const rows = await getSheetValues('HelpRequests')
  return rows.slice(1).map(rowToHelp).filter(h => h.status === 'OPEN')
}

export async function resolveHelpRequest(helpId: string): Promise<HelpRequest | null> {
  const rows = await getSheetValues('HelpRequests')
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === helpId) {
      const help = rowToHelp(rows[i])
      help.status = 'RESOLVED'
      help.resolvedAt = new Date().toISOString()
      await updateRow('HelpRequests', i + 1, helpToRow(help))
      return help
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Dashboard aggregates
// ---------------------------------------------------------------------------

export async function getDashboardData(): Promise<DashboardData> {
  const [patientRows, clinicRows, eventRows, helpRows] = await Promise.all([
    getSheetValues('Patients'),
    getSheetValues('Clinics'),
    getSheetValues('Events'),
    getSheetValues('HelpRequests'),
  ])

  const patients = patientRows.slice(1).map(rowToPatient).filter(p => p.hn)
  const clinics = clinicRows.slice(1).map(rowToClinic).filter(c => c.clinicId)
  const events = eventRows.slice(1).map(rowToEvent).filter(e => e.eventId)
  const helps = helpRows.slice(1).map(rowToHelp).filter(h => h.helpId)

  const clinicMap = Object.fromEntries(clinics.map(c => [c.clinicId, c.name]))

  // Status counts
  const statusCounts: Record<PatientStatus, number> = {
    REGISTERED: 0, BOUND: 0, IN_PROGRESS: 0, COMPLETED: 0,
  }
  patients.forEach(p => { statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1 })

  // Per-clinic current queue count
  const clinicCountMap: Record<string, number> = {}
  patients.forEach(p => {
    if (p.status === 'COMPLETED') return
    const seq: string[] = JSON.parse(p.sequenceJson || '[]')
    const cid = seq[p.currentIndex]
    if (cid) clinicCountMap[cid] = (clinicCountMap[cid] ?? 0) + 1
  })
  const clinicCounts = Object.entries(clinicCountMap).map(([clinicId, count]) => ({
    clinicId, name: clinicMap[clinicId] ?? clinicId, count,
  }))

  // Open help requests enriched with clinic name
  const openHelp = helps
    .filter(h => h.status === 'OPEN')
    .map(h => ({ ...h, clinicName: clinicMap[h.clinicId] ?? h.clinicId }))

  // Funnel
  const funnelData = [
    { stage: 'ลงทะเบียน', count: patients.length },
    { stage: 'เชื่อม LINE', count: patients.filter(p => p.status !== 'REGISTERED').length },
    { stage: 'กำลังรักษา', count: patients.filter(p => p.status === 'IN_PROGRESS').length },
    { stage: 'เสร็จสิ้น', count: statusCounts.COMPLETED },
  ]

  // Avg dwell time per clinic (ARRIVED → COMPLETED pairs)
  const arrivedMap: Record<string, Record<string, string>> = {}
  const dwellSums: Record<string, { sum: number; count: number }> = {}
  events.forEach(e => {
    if (e.type === 'ARRIVED') {
      if (!arrivedMap[e.hn]) arrivedMap[e.hn] = {}
      arrivedMap[e.hn][e.clinicId] = e.timestamp
    } else if (e.type === 'COMPLETED') {
      const arr = arrivedMap[e.hn]?.[e.clinicId]
      if (arr) {
        const mins = (Date.parse(e.timestamp) - Date.parse(arr)) / 60000
        if (!dwellSums[e.clinicId]) dwellSums[e.clinicId] = { sum: 0, count: 0 }
        dwellSums[e.clinicId].sum += mins
        dwellSums[e.clinicId].count++
      }
    }
  })
  const dwellTimes = Object.entries(dwellSums).map(([clinicId, { sum, count }]) => ({
    clinicId,
    name: clinicMap[clinicId] ?? clinicId,
    avgMinutes: Math.round(sum / count),
  }))

  // Throughput by hour (COMPLETED events today)
  const today = new Date().toISOString().slice(0, 10)
  const hourMap: Record<string, number> = {}
  events
    .filter(e => e.type === 'COMPLETED' && e.timestamp.startsWith(today))
    .forEach(e => {
      const h = e.timestamp.slice(11, 13) + ':00'
      hourMap[h] = (hourMap[h] ?? 0) + 1
    })
  const throughputByHour = Object.entries(hourMap)
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour.localeCompare(b.hour))

  // Help by clinic
  const helpClinicMap: Record<string, number> = {}
  helps.forEach(h => { helpClinicMap[h.clinicId] = (helpClinicMap[h.clinicId] ?? 0) + 1 })
  const helpByClinic = Object.entries(helpClinicMap).map(([clinicId, count]) => ({
    clinicId, name: clinicMap[clinicId] ?? clinicId, count,
  }))

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const completedToday = patients.filter(
    p => p.status === 'COMPLETED' && Date.parse(p.updatedAt) >= todayStart.getTime(),
  ).length

  return {
    statusCounts,
    clinicCounts,
    openHelpRequests: openHelp,
    funnelData,
    dwellTimes,
    throughputByHour,
    helpByClinic,
    activeCount: statusCounts.BOUND + statusCounts.IN_PROGRESS,
    completedToday,
  }
}

// ---------------------------------------------------------------------------
// PatientHistory tab — archived completed patients
// Columns: same as Patients + completedAt
// ---------------------------------------------------------------------------

const PH_HEADERS = [
  'hn','lineUserId','bindToken','bindTokenUsed','sequenceJson',
  'currentIndex','status','needHelp','createdAt','updatedAt','completedAt',
]

export interface PatientHistoryRow extends Patient { completedAt: string }

function rowToHistory(row: string[]): PatientHistoryRow {
  return {
    ...rowToPatient(row),
    completedAt: row[10] ?? '',
  }
}

export async function archivePatient(patient: Patient): Promise<void> {
  const completedAt = new Date().toISOString()
  // Ensure PatientHistory has headers
  const hRows = await getSheetValues('PatientHistory')
  if (!hRows.length) await appendRow('PatientHistory', PH_HEADERS)

  // Append to PatientHistory
  await appendRow('PatientHistory', [...patientToRow(patient), completedAt])

  // Delete from active Patients sheet
  await deletePatientRow(patient.hn)
}

async function getNumericSheetId(tabName: string): Promise<number> {
  const cached = getCachedSheetId(tabName)
  if (cached !== null) return cached

  const sheets = getSheets()
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID() })
  const sheet = meta.data.sheets?.find(s => s.properties?.title === tabName)
  if (!sheet?.properties?.sheetId) throw new Error(`Sheet "${tabName}" not found`)
  const id = sheet.properties.sheetId
  setCachedSheetId(tabName, id)
  return id
}

export async function deletePatientRow(hn: string): Promise<void> {
  const rows = await getSheetValues('Patients')
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === hn)
  if (rowIndex === -1) return   // already gone — idempotent

  const sheetId = await getNumericSheetId('Patients')
  const sheets = getSheets()
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID(),
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
        },
      }],
    },
  })
}

export async function getPatientHistory(limit = 100): Promise<PatientHistoryRow[]> {
  const rows = await getSheetValues('PatientHistory')
  return rows
    .slice(1)
    .map(rowToHistory)
    .filter(r => r.hn)
    .reverse()          // newest first
    .slice(0, limit)
}

