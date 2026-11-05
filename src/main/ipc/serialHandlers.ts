import { handle, requireInput } from './validation'
import { serialService } from '../serial/SerialService'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error desconocido.'
}

export function registerSerialHandlers(): void {
  handle('serial:list-ports', async () => {
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

  handle(
    'serial:test-connection',
    async (_event, configuration: { path: string; baudRate: number }) => {
      try {
        requireInput(
          configuration &&
            typeof configuration.path === 'string' &&
            configuration.path.length > 0 &&
            configuration.path.length <= 256 &&
            !configuration.path.includes('\0') &&
            configuration.baudRate === 9600
        )
        const ports = await serialService.listPorts()
        requireInput(ports.some((port) => port.path === configuration.path))
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

  handle('serial:connect', async (_event, configuration: { path: string; baudRate: number }) => {
    try {
      requireInput(
        configuration &&
          typeof configuration.path === 'string' &&
          configuration.path.length > 0 &&
          configuration.path.length <= 256 &&
          !configuration.path.includes('\0') &&
          configuration.baudRate === 9600
      )
      const ports = await serialService.listPorts()
      requireInput(ports.some((port) => port.path === configuration.path))
      const result = await serialService.connect(configuration.path, configuration.baudRate)

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
  })

  handle('serial:disconnect', async () => {
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

  handle('serial:get-state', async () => {
    return {
      success: true,
      data: serialService.getConnectionState()
    }
  })
}
