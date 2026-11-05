import { handle, requireInput, validId, validIds, validDate, safeDatabaseError } from './validation'
import { databaseService } from '../database/DatabaseService'
import { reportExportService } from '../reports/ReportExportService'
import type { ReportSummary } from '../../renderer/src/types/database'

export function registerDatabaseHandlers(): void {
  handle('database:test-connection', async () => {
    try {
      await databaseService.testConnection()
      return {
        success: true,
        message: 'Conexión con MariaDB verificada.'
      }
    } catch (error) {
      return {
        success: false,
        message: safeDatabaseError(error)
      }
    }
  })

  handle('database:create-session', async (_event, request) => {
    try {
      requireInput(request && typeof request === 'object')
      requireInput(
        typeof request.name === 'string' &&
          request.name.trim().length > 0 &&
          request.name.length <= 150
      )
      requireInput(typeof request.location === 'string' && request.location.length <= 150)
      requireInput(
        typeof request.description === 'string' &&
          Buffer.byteLength(request.description, 'utf8') <= 65535
      )
      requireInput(request.mode === 'manual' || request.mode === 'timed')
      requireInput(
        validId(request.storageIntervalSeconds) && request.storageIntervalSeconds <= 2147483647
      )
      requireInput(
        request.mode === 'manual'
          ? request.durationSeconds === null
          : validId(request.durationSeconds) && request.durationSeconds <= 2147483647
      )
      requireInput(validDate(request.startedAt))
      const sessionId = await databaseService.createSession(request)
      return {
        success: true,
        data: { sessionId }
      }
    } catch (error) {
      return {
        success: false,
        message: safeDatabaseError(error)
      }
    }
  })

  handle('database:save-measurement', async (_event, request) => {
    try {
      requireInput(
        request &&
          validId(request.sessionId) &&
          request.measurement &&
          typeof request.measurement === 'object'
      )
      const m = request.measurement
      for (const key of [
        'uvAdc',
        'uvVoltage',
        'luminosity',
        'temperature',
        'humidity',
        'pressure'
      ]) {
        requireInput(m[key] === null || (typeof m[key] === 'number' && Number.isFinite(m[key])))
      }
      requireInput(
        m.uvAdc === null || (Number.isInteger(m.uvAdc) && m.uvAdc >= 0 && m.uvAdc <= 2147483647)
      )
      for (const [key, limit] of Object.entries({
        uvVoltage: 10000,
        luminosity: 100000000,
        temperature: 10000,
        humidity: 10000,
        pressure: 1000000
      })) {
        requireInput(m[key] === null || Math.abs(m[key]) < limit)
      }
      requireInput(m.uvVoltage === null || m.uvVoltage >= 0)
      requireInput(m.luminosity === null || m.luminosity >= 0)
      requireInput(m.pressure === null || m.pressure > 0)
      requireInput(m.humidity === null || (m.humidity >= 0 && m.humidity <= 100))
      requireInput(m.level === null || ['BAJO', 'MEDIO', 'ALTO'].includes(m.level))
      requireInput(m.presence === null || typeof m.presence === 'boolean')
      requireInput(
        m.dateTime === null || (typeof m.dateTime === 'string' && m.dateTime.length <= 30)
      )
      requireInput(validDate(m.receivedAt))
      const measurementId = await databaseService.saveMeasurement(request)
      return {
        success: true,
        data: { measurementId }
      }
    } catch (error) {
      return {
        success: false,
        message: safeDatabaseError(error)
      }
    }
  })

  handle('database:finish-session', async (_event, request) => {
    try {
      requireInput(request && validId(request.sessionId) && validDate(request.finishedAt))
      await databaseService.finishSession(request.sessionId, request.finishedAt)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        message: safeDatabaseError(error)
      }
    }
  })

  handle('database:cancel-session', async (_event, request) => {
    try {
      requireInput(request && validId(request.sessionId) && validDate(request.finishedAt))
      await databaseService.cancelSession(request.sessionId, request.finishedAt)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        message: safeDatabaseError(error)
      }
    }
  })

  handle('database:list-sessions', async () => {
    try {
      const sessions = await databaseService.listSessions()
      return {
        success: true,
        data: sessions
      }
    } catch (error) {
      return {
        success: false,
        data: [],
        message: safeDatabaseError(error)
      }
    }
  })

  handle('database:get-session-detail', async (_event, sessionId) => {
    try {
      requireInput(validId(sessionId))
      const detail = await databaseService.getSessionDetail(sessionId)
      return {
        success: true,
        data: detail
      }
    } catch (error) {
      return {
        success: false,
        message: safeDatabaseError(error)
      }
    }
  })

  handle('database:get-report', async (_event, sessionIds) => {
    try {
      validIds(sessionIds)
      const report = await databaseService.getReport([...new Set(sessionIds)])
      return {
        success: true,
        data: report
      }
    } catch (error) {
      return {
        success: false,
        message: safeDatabaseError(error)
      }
    }
  })

  handle('database:export-report-csv', async (_event, sessionIds) => {
    try {
      validIds(sessionIds)
      const report = (await databaseService.getReport([...new Set(sessionIds)])) as ReportSummary
      const filePath = await reportExportService.exportCsv(report)

      return {
        success: true,
        data: {
          filePath,
          canceled: filePath === null
        }
      }
    } catch (error) {
      return {
        success: false,
        message: safeDatabaseError(error)
      }
    }
  })

  handle('database:export-report-pdf', async (_event, sessionIds) => {
    try {
      validIds(sessionIds)
      const report = (await databaseService.getReport([...new Set(sessionIds)])) as ReportSummary
      const filePath = await reportExportService.exportPdf(report)

      return {
        success: true,
        data: {
          filePath,
          canceled: filePath === null
        }
      }
    } catch (error) {
      return {
        success: false,
        message: safeDatabaseError(error)
      }
    }
  })
}
