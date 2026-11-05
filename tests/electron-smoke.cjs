const { app, BrowserWindow, dialog } = require('electron')
const { resolve, dirname } = require('node:path')
const { readFileSync, mkdirSync } = require('node:fs')
const Module = require('node:module')
const assert = require('node:assert/strict')
const ts = require('typescript')

// Run with Electron after npm run build. This checks actual sandbox/preload and
// Chromium PDF generation, without opening a visible window or using hardware.
function load(file) {
  const filename = resolve(file)
  const code = ts
    .transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true }
    })
    .outputText.replaceAll('__dirname', JSON.stringify(resolve('out/main')))
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(dirname(filename))
  loaded._compile(code, filename)
  return loaded.exports
}

const deadline = setTimeout(() => {
  console.error('Electron smoke test timed out')
  app.exit(1)
}, 20000)

app
  .whenReady()
  .then(async () => {
    const ports = await require('serialport').SerialPort.list()
    assert.ok(Array.isArray(ports))
    const { handle } = load('src/main/ipc/validation.ts')
    handle('serial:get-state', () => ({ success: true, data: { connected: false, path: null } }))
    handle('serial:list-ports', () => ({ success: true, data: [] }))
    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: resolve('out/preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    try {
      await window.loadFile(resolve('out/renderer/index.html'))
      const state = await window.webContents.executeJavaScript(`(async () => ({
      title: document.title,
      bridge: typeof window.api?.serial?.getState,
      node: typeof window.require,
      genericBridge: typeof window.electron,
      result: await window.api.serial.getState()
    }))()`)
      assert.equal(state.title, 'Monitor Ambiental UV')
      assert.equal(state.bridge, 'function')
      assert.equal(state.node, 'undefined')
      assert.equal(state.genericBridge, 'undefined')
      assert.equal(state.result.success, true)
      let rendered = ''
      for (let attempt = 0; attempt < 20; attempt++) {
        rendered = await window.webContents.executeJavaScript(
          'document.getElementById("root").textContent'
        )
        if (rendered.includes('Puerto serial')) break
        await new Promise((done) => setTimeout(done, 100))
      }
      assert.ok(rendered.includes('Puerto serial'))
      const untrusted = new BrowserWindow({
        show: false,
        webPreferences: {
          preload: resolve('out/preload/index.js'),
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false
        }
      })
      try {
        await untrusted.loadURL('data:text/html,untrusted')
        const result = await untrusted.webContents.executeJavaScript('window.api.serial.getState()')
        assert.equal(result.success, false)
      } finally {
        untrusted.destroy()
      }

      const { reportExportService } = load('src/main/reports/ReportExportService.ts')
      const destination = resolve('node_modules/.cache/monitor-uv-smoke.pdf')
      mkdirSync(dirname(destination), { recursive: true })
      const originalDialog = dialog.showSaveDialog
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination })
      try {
        await reportExportService.exportPdf({
          sessions: [
            {
              sessionId: 1,
              name: 'Prueba <UV>',
              location: 'UNMSM',
              description: 'Acentos: medición y presión',
              startedAt: '2026-11-04 12:00:00',
              totalSamples: 2
            }
          ],
          stats: { samples: 2, uvMax: 0.5, presenceCount: 0 },
          measurements: [0.4, 0.5].map((uvVoltage, index) => ({
            sessionId: 1,
            measurementId: index + 1,
            uvVoltage,
            temperature: 25,
            humidity: 60,
            pressure: 1013,
            luminosity: 120,
            receivedAt: '2026-11-04 12:00:00',
            dateTime: null
          }))
        })
        assert.equal(readFileSync(destination).subarray(0, 5).toString(), '%PDF-')
      } finally {
        dialog.showSaveDialog = originalDialog
      }
      console.log(
        'Electron smoke passed: sandbox, preload, authorized IPC, native SerialPort, PDF generation'
      )
    } finally {
      window.destroy()
    }
  })
  .then(() => {
    clearTimeout(deadline)
    app.exit(0)
  })
  .catch((error) => {
    console.error(error)
    clearTimeout(deadline)
    app.exit(1)
  })
