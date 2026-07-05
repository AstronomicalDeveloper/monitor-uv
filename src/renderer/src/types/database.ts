import type { Measurement } from './serial'

export type CaptureMode = 'manual' | 'timed'
export type SessionStatus = 'active' | 'finished' | 'cancelled'

export interface CaptureSessionInput {
  name: string
  location: string
  description: string
  mode: CaptureMode
  durationSeconds: number | null
  storageIntervalSeconds: number
}

export interface CaptureSession extends CaptureSessionInput {
  id: string
  databaseId: number | null
  startedAt: string
  finishedAt: string | null
  status: SessionStatus
}

export interface CreateSessionRequest {
  name: string
  location: string
  description: string
  mode: CaptureMode
  durationSeconds: number | null
  storageIntervalSeconds: number
  startedAt: string
}

export interface SaveMeasurementRequest {
  sessionId: number
  measurement: Measurement
}

export interface SessionSummary {
  sessionId: number
  name: string
  location: string | null
  description: string | null
  mode: CaptureMode
  durationSeconds: number | null
  storageIntervalSeconds: number
  startedAt: string
  finishedAt: string | null
  status: SessionStatus
  totalSamples: number
  uvMax: number | null
  uvAvg: number | null
  temperatureAvg: number | null
  luminosityAvg: number | null
}

export interface StoredMeasurement extends Measurement {
  measurementId: number
  sessionId: number
}

export interface SessionStats {
  samples: number
  uvMin: number | null
  uvMax: number | null
  uvAvg: number | null
  temperatureMin: number | null
  temperatureMax: number | null
  temperatureAvg: number | null
  humidityMin: number | null
  humidityMax: number | null
  humidityAvg: number | null
  pressureMin: number | null
  pressureMax: number | null
  pressureAvg: number | null
  luminosityMin: number | null
  luminosityMax: number | null
  luminosityAvg: number | null
  presenceCount: number
}

export interface SessionDetail {
  session: SessionSummary
  stats: SessionStats
  measurements: StoredMeasurement[]
}

export interface ReportSummary {
  sessionIds: number[]
  sessions: SessionSummary[]
  stats: SessionStats
  measurements: StoredMeasurement[]
}

export interface ExportResult {
  filePath: string | null
  canceled: boolean
}
