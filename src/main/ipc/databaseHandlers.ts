import { ipcMain } from 'electron'
import { databaseService } from '../database/DatabaseService'
import { reportExportService } from '../reports/ReportExportService'
import type { ReportSummary } from '../../renderer/src/types/database'

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Ocurrió un error desconocido.'
}

export function registerDatabaseHandlers(): void {
  ipcMain.handle('database:test-connection', async () => {
    try {
      await databaseService.testConnection()
      return {
        success: true,
        message: 'Conexión con MariaDB verificada.'
      }
    } catch (error) {
      return {
        success: false,
        message: getErrorMessage(error)
      }
    }
  })

  ipcMain.handle('database:create-session', async (_event, request) => {
    try {
      const sessionId = await databaseService.createSession(request)
      return {
        success: true,
        data: { sessionId }
      }
    } catch (error) {
      return {
        success: false,
        message: getErrorMessage(error)
      }
    }
  })

  ipcMain.handle('database:save-measurement', async (_event, request) => {
    try {
      const measurementId = await databaseService.saveMeasurement(request)
      return {
        success: true,
        data: { measurementId }
      }
    } catch (error) {
      return {
        success: false,
        message: getErrorMessage(error)
      }
    }
  })

  ipcMain.handle('database:finish-session', async (_event, request) => {
    try {
      await databaseService.finishSession(request.sessionId, request.finishedAt)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        message: getErrorMessage(error)
      }
    }
  })

  ipcMain.handle('database:cancel-session', async (_event, request) => {
    try {
      await databaseService.cancelSession(request.sessionId, request.finishedAt)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        message: getErrorMessage(error)
      }
    }
  })

  ipcMain.handle('database:list-sessions', async () => {
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
        message: getErrorMessage(error)
      }
    }
  })

  ipcMain.handle('database:get-session-detail', async (_event, sessionId) => {
    try {
      const detail = await databaseService.getSessionDetail(Number(sessionId))
      return {
        success: true,
        data: detail
      }
    } catch (error) {
      return {
        success: false,
        message: getErrorMessage(error)
      }
    }
  })

  ipcMain.handle('database:get-report', async (_event, sessionIds) => {
    try {
      const report = await databaseService.getReport(
        Array.isArray(sessionIds) ? sessionIds.map(Number) : []
      )
      return {
        success: true,
        data: report
      }
    } catch (error) {
      return {
        success: false,
        message: getErrorMessage(error)
      }
    }
  })

  ipcMain.handle('database:export-report-csv', async (_event, sessionIds) => {
    try {
      const report = await databaseService.getReport(
        Array.isArray(sessionIds) ? sessionIds.map(Number) : []
      ) as ReportSummary
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
        message: getErrorMessage(error)
      }
    }
  })

  ipcMain.handle('database:export-report-pdf', async (_event, sessionIds) => {
    try {
      const report = await databaseService.getReport(
        Array.isArray(sessionIds) ? sessionIds.map(Number) : []
      ) as ReportSummary
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
        message: getErrorMessage(error)
      }
    }
  })
}
