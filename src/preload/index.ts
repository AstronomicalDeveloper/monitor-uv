import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  Measurement,
  SerialConfiguration
} from '../renderer/src/types/serial'
import type {
  CreateSessionRequest,
  SaveMeasurementRequest
} from '../renderer/src/types/database'

const api = {
  serial: {
    listPorts: () =>
      ipcRenderer.invoke('serial:list-ports'),

    testConnection: (configuration: SerialConfiguration) =>
      ipcRenderer.invoke(
        'serial:test-connection',
        configuration
      ),

    connect: (configuration: SerialConfiguration) =>
      ipcRenderer.invoke(
        'serial:connect',
        configuration
      ),

    disconnect: () =>
      ipcRenderer.invoke('serial:disconnect'),

    getState: () =>
      ipcRenderer.invoke('serial:get-state'),

    onMeasurement: (
      callback: (measurement: Measurement) => void
    ) => {
      const listener = (_event: Electron.IpcRendererEvent, measurement: Measurement): void => {
        callback(measurement)
      }

      ipcRenderer.on('serial:measurement', listener)

      return () => {
        ipcRenderer.removeListener(
          'serial:measurement',
          listener
        )
      }
    },

    onDisconnected: (
      callback: (data: { path: string | null }) => void
    ) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { path: string | null }): void => {
        callback(data)
      }

      ipcRenderer.on('serial:disconnected', listener)

      return () => {
        ipcRenderer.removeListener(
          'serial:disconnected',
          listener
        )
      }
    },

    onConnectionError: (
      callback: (data: { message: string }) => void
    ) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { message: string }): void => {
        callback(data)
      }

      ipcRenderer.on(
        'serial:connection-error',
        listener
      )

      return () => {
        ipcRenderer.removeListener(
          'serial:connection-error',
          listener
        )
      }
    }
  },

  database: {
    testConnection: () =>
      ipcRenderer.invoke('database:test-connection'),

    createSession: (request: CreateSessionRequest) =>
      ipcRenderer.invoke('database:create-session', request),

    saveMeasurement: (request: SaveMeasurementRequest) =>
      ipcRenderer.invoke('database:save-measurement', request),

    finishSession: (request: { sessionId: number; finishedAt: string }) =>
      ipcRenderer.invoke('database:finish-session', request),

    cancelSession: (request: { sessionId: number; finishedAt: string }) =>
      ipcRenderer.invoke('database:cancel-session', request),

    listSessions: () =>
      ipcRenderer.invoke('database:list-sessions'),

    getSessionDetail: (sessionId: number) =>
      ipcRenderer.invoke('database:get-session-detail', sessionId),

    getReport: (sessionIds: number[]) =>
      ipcRenderer.invoke('database:get-report', sessionIds),

    exportReportCsv: (sessionIds: number[]) =>
      ipcRenderer.invoke('database:export-report-csv', sessionIds),

    exportReportPdf: (sessionIds: number[]) =>
      ipcRenderer.invoke('database:export-report-pdf', sessionIds)
  }
}

type Api = typeof api

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
