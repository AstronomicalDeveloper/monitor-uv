import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { registerSerialHandlers } from './ipc/serialHandlers'
import { registerDatabaseHandlers } from './ipc/databaseHandlers'
import { serialService } from './serial/SerialService'
import { databaseService } from './database/DatabaseService'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 950,
    minHeight: 650,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  /*
   * Envía cada medición completa desde el proceso principal
   * hacia la interfaz React.
   */
  const forwardMeasurement = (measurement: Record<string, unknown>): void => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('serial:measurement', measurement)
    }
  }

  /*
   * Informa a React cuando el puerto serial se cierra
   * o el dispositivo se desconecta.
   */
  const forwardDisconnection = (data: Record<string, unknown>): void => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('serial:disconnected', data)
    }
  }

  /*
   * Informa a React cuando ocurre un error durante
   * la comunicación serial.
   */
  const forwardConnectionError = (data: Record<string, unknown>): void => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('serial:connection-error', data)
    }
  }

  /*
   * Escuchamos los eventos generados por SerialService.
   */
  serialService.on('measurement', forwardMeasurement)

  serialService.on('disconnected', forwardDisconnection)

  serialService.on('connection-error', forwardConnectionError)

  /*
   * Eliminamos los listeners cuando la ventana se cierre.
   * Esto evita duplicar eventos si Electron vuelve a crearla.
   */
  mainWindow.on('closed', () => {
    serialService.off('measurement', forwardMeasurement)

    serialService.off('disconnected', forwardDisconnection)

    serialService.off('connection-error', forwardConnectionError)
  })

  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false)
  )
  let closingWindow = false
  mainWindow.on('close', (event) => {
    if (shutdownComplete) return
    event.preventDefault()
    if (closingWindow) return
    closingWindow = true
    if (process.platform === 'darwin') {
      // Keep the macOS app reusable when only its last window is closed.
      void (async () => {
        try {
          await serialService.disconnect()
          await databaseService.finishOpenSessions()
        } catch {
          console.error('No se pudieron finalizar las sesiones al cerrar la ventana.')
        } finally {
          mainWindow.destroy()
        }
      })()
      return
    }
    void shutdown().then(() => app.quit())
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        void shell.openExternal(url.href).catch(() => undefined)
      }
    } catch {
      /* Ignore malformed links. */
    }

    return {
      action: 'deny'
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('io.github.astronomicaldeveloper.monitoruv')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  /*
   * Registramos las operaciones IPC:
   * listar puertos, probar, conectar, desconectar y consultar estado.
   */
  registerSerialHandlers()
  registerDatabaseHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

/*
 * Antes de cerrar Electron intentamos liberar
 * correctamente el puerto serial.
 */
let shutdownComplete = false
let shutdownPending: Promise<void> | null = null
function shutdown(): Promise<void> {
  if (!shutdownPending)
    shutdownPending = (async () => {
      try {
        await serialService.disconnect()
      } catch {
        console.error('No se pudo cerrar el puerto serial.')
      }
      try {
        await databaseService.close()
      } catch {
        console.error('No se pudieron finalizar todas las sesiones en MariaDB.')
      }
      shutdownComplete = true
    })()
  return shutdownPending
}
app.on('before-quit', (event) => {
  if (shutdownComplete) return
  event.preventDefault()
  void shutdown().then(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
