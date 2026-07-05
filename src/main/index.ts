import { app, shell, BrowserWindow, ipcMain } from 'electron'
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
      sandbox: false
    }
  })

  /*
   * Envía cada medición completa desde el proceso principal
   * hacia la interfaz React.
   */
  const forwardMeasurement = (
    measurement: Record<string, unknown>
  ): void => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(
        'serial:measurement',
        measurement
      )
    }
  }

  /*
   * Informa a React cuando el puerto serial se cierra
   * o el dispositivo se desconecta.
   */
  const forwardDisconnection = (
    data: Record<string, unknown>
  ): void => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(
        'serial:disconnected',
        data
      )
    }
  }

  /*
   * Informa a React cuando ocurre un error durante
   * la comunicación serial.
   */
  const forwardConnectionError = (
    data: Record<string, unknown>
  ): void => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(
        'serial:connection-error',
        data
      )
    }
  }

  /*
   * Escuchamos los eventos generados por SerialService.
   */
  serialService.on(
    'measurement',
    forwardMeasurement
  )

  serialService.on(
    'disconnected',
    forwardDisconnection
  )

  serialService.on(
    'connection-error',
    forwardConnectionError
  )

  /*
   * Eliminamos los listeners cuando la ventana se cierre.
   * Esto evita duplicar eventos si Electron vuelve a crearla.
   */
  mainWindow.on('closed', () => {
    serialService.off(
      'measurement',
      forwardMeasurement
    )

    serialService.off(
      'disconnected',
      forwardDisconnection
    )

    serialService.off(
      'connection-error',
      forwardConnectionError
    )
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(
    (details) => {
      shell.openExternal(details.url)

      return {
        action: 'deny'
      }
    }
  )

  if (
    is.dev &&
    process.env['ELECTRON_RENDERER_URL']
  ) {
    mainWindow.loadURL(
      process.env['ELECTRON_RENDERER_URL']
    )
  } else {
    mainWindow.loadFile(
      join(__dirname, '../renderer/index.html')
    )
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on(
    'browser-window-created',
    (_, window) => {
      optimizer.watchWindowShortcuts(window)
    }
  )

  ipcMain.on('ping', () => {
    console.log('pong')
  })

  /*
   * Registramos las operaciones IPC:
   * listar puertos, probar, conectar, desconectar y consultar estado.
   */
  registerSerialHandlers()
  registerDatabaseHandlers()

  createWindow()

  app.on('activate', () => {
    if (
      BrowserWindow.getAllWindows().length === 0
    ) {
      createWindow()
    }
  })
})

/*
 * Antes de cerrar Electron intentamos liberar
 * correctamente el puerto serial.
 */
app.on('before-quit', async () => {
  try {
    await serialService.disconnect()
    await databaseService.close()
  } catch (error) {
    console.error(
      'No se pudo cerrar el puerto serial:',
      error
    )
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})