import type {
  Measurement,
  SerialConfiguration,
  SerialConnectionState,
  SerialPortInfo,
  SerialResult
} from '../renderer/src/types/serial'
import type {
  CreateSessionRequest,
  SaveMeasurementRequest,
  SessionDetail,
  SessionSummary,
  ReportSummary,
  ExportResult
} from '../renderer/src/types/database'

export interface SerialApi {
  listPorts: () => Promise<SerialResult<SerialPortInfo[]>>

  testConnection: (
    configuration: SerialConfiguration
  ) => Promise<
    SerialResult<{
      path: string
      baudRate: number
      firstLine: string
    }>
  >

  connect: (
    configuration: SerialConfiguration
  ) => Promise<
    SerialResult<{
      path: string
      baudRate: number
      alreadyConnected: boolean
    }>
  >

  disconnect: () => Promise<SerialResult>

  getState: () => Promise<SerialResult<SerialConnectionState>>

  onMeasurement: (
    callback: (measurement: Measurement) => void
  ) => () => void

  onDisconnected: (
    callback: (data: { path: string | null }) => void
  ) => () => void

  onConnectionError: (
    callback: (data: { message: string }) => void
  ) => () => void
}

export interface DatabaseApi {
  testConnection: () => Promise<SerialResult>

  createSession: (
    request: CreateSessionRequest
  ) => Promise<SerialResult<{ sessionId: number }>>

  saveMeasurement: (
    request: SaveMeasurementRequest
  ) => Promise<SerialResult<{ measurementId: number }>>

  finishSession: (
    request: { sessionId: number; finishedAt: string }
  ) => Promise<SerialResult>

  cancelSession: (
    request: { sessionId: number; finishedAt: string }
  ) => Promise<SerialResult>

  listSessions: () => Promise<SerialResult<SessionSummary[]>>

  getSessionDetail: (
    sessionId: number
  ) => Promise<SerialResult<SessionDetail>>

  getReport: (
    sessionIds: number[]
  ) => Promise<SerialResult<ReportSummary>>

  exportReportCsv: (
    sessionIds: number[]
  ) => Promise<SerialResult<ExportResult>>

  exportReportPdf: (
    sessionIds: number[]
  ) => Promise<SerialResult<ExportResult>>
}

declare global {
  interface Window {
    api: {
      serial: SerialApi
      database: DatabaseApi
    }

    electron: unknown
  }
}
