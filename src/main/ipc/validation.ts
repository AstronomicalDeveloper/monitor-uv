import { ipcMain } from 'electron'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'

export class InputError extends Error {}
export function requireInput(condition: unknown): asserts condition {
  if (!condition) throw new InputError('Los argumentos recibidos no son validos.')
}
export function validId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}
export function validDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 40 &&
    Number.isFinite(new Date(value).getTime()) &&
    new Date(value).toISOString() === value
  )
}
export function validIds(value: unknown): asserts value is number[] {
  requireInput(
    Array.isArray(value) && value.length > 0 && value.length <= 1000 && value.every(validId)
  )
}
export function safeDatabaseError(error: unknown): string {
  if (error instanceof InputError) return error.message
  // Never propagate driver errors, SQL, configuration or credentials to the renderer.
  return 'No se pudo completar la operacion en MariaDB. Revisa la configuracion local y el servicio.'
}
export const handle: typeof ipcMain.handle = (channel, listener) => {
  ipcMain.handle(channel, (event, ...args) => {
    const expected =
      is.dev && process.env.ELECTRON_RENDERER_URL
        ? process.env.ELECTRON_RENDERER_URL
        : pathToFileURL(join(__dirname, '../renderer/index.html')).href
    const senderUrl = event.senderFrame?.url.split('#')[0]
    if (
      event.senderFrame !== event.sender.mainFrame ||
      senderUrl !== new URL(expected).href.split('#')[0]
    ) {
      return { success: false, message: 'Origen IPC no autorizado.' }
    }
    return listener(event, ...args)
  })
}
