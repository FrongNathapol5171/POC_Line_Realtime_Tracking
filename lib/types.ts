export type PatientStatus = 'REGISTERED' | 'BOUND' | 'IN_PROGRESS' | 'COMPLETED'

export type EventType =
  | 'REGISTERED'
  | 'BOUND'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'HELP_REQUESTED'
  | 'HELP_RESOLVED'

export type HelpStatus = 'OPEN' | 'RESOLVED'

export interface Patient {
  hn: string
  lineUserId: string
  bindToken: string
  bindTokenUsed: boolean
  sequenceJson: string        // JSON array of clinicIds e.g. '["clinic_a","BILLING"]'
  currentIndex: number
  status: PatientStatus
  needHelp: boolean
  createdAt: string
  updatedAt: string
}

export interface Clinic {
  clinicId: string
  name: string
  detail: string
  displayOrder: number
  active: boolean
}

export interface PatientEvent {
  eventId: string
  hn: string
  clinicId: string
  type: EventType
  timestamp: string
}

export interface HelpRequest {
  helpId: string
  hn: string
  clinicId: string
  status: HelpStatus
  createdAt: string
  resolvedAt: string
}

export interface DashboardData {
  statusCounts: Record<PatientStatus, number>
  clinicCounts: Array<{ clinicId: string; name: string; count: number }>
  openHelpRequests: Array<HelpRequest & { clinicName: string }>
  funnelData: Array<{ stage: string; count: number }>
  dwellTimes: Array<{ clinicId: string; name: string; avgMinutes: number }>
  throughputByHour: Array<{ hour: string; count: number }>
  helpByClinic: Array<{ clinicId: string; name: string; count: number }>
  activeCount: number
  completedToday: number
}
