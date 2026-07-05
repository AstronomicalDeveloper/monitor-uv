import { ipcMain } from 'electron'
import { serialService } from '../serial/SerialService'

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Ocurrió un error desconocido.'
}

export function registerSerialHandlers(): void {
  ipcMain.handle('serial:list-ports', async () => {
    try {
      const ports = await serialService.listPorts()

      return {
        success: true,
        data: ports
      }
    } catch (error) {
      return {
        success: false,
        data: [],
        message: getErrorMessage(error)
      }
    }
  })

  ipcMain.handle(
    'serial:test-connection',
    async (_event, configuration: { path: string; baudRate: number }) => {
      try {
        const result = await serialService.testConnection(
          configuration.path,
          configuration.baudRate
        )

        return {
          success: true,
          data: result
        }
      } catch (error) {
        return {
          success: false,
          message: getErrorMessage(error)
        }
      }
    }
  )

  ipcMain.handle(
    'serial:connect',
    async (_event, configuration: { path: string; baudRate: number }) => {
      try {
        const result = await serialService.connect(
          configuration.path,
          configuration.baudRate
        )

        return {
          success: true,
          data: result
        }
      } catch (error) {
        return {
          success: false,
          message: getErrorMessage(error)
        }
      }
    }
  )

  ipcMain.handle('serial:disconnect', async () => {
    try {
      await serialService.disconnect()

      return {
        success: true
      }
    } catch (error) {
      return {
        success: false,
        message: getErrorMessage(error)
      }
    }
  })

  ipcMain.handle('serial:get-state', async () => {
    return {
      success: true,
      data: serialService.getConnectionState()
    }
  })
}