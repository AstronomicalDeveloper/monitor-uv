const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve, dirname } = require('node:path')
const { createRequire } = require('node:module')
const vm = require('node:vm')
const ts = require('typescript')

// Compile the real modules with the existing TypeScript dependency. Only external
// services are replaced: no MariaDB server, Electron runtime or hardware needed.
function load(file, mocks = {}, globals = {}) {
  const filename = resolve(file)
  const nativeRequire = createRequire(filename)
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX
    }
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(
    source,
    {
      module,
      exports: module.exports,
      __dirname: dirname(filename),
      require: (name) => (Object.hasOwn(mocks, name) ? mocks[name] : nativeRequire(name)),
      console,
      process,
      Buffer,
      URL,
      Date,
      setTimeout,
      clearTimeout,
      ...globals
    },
    { filename }
  )
  return module.exports
}

const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const tick = () => new Promise((done) => setImmediate(done))
const measurement = {
  uvAdc: 100,
  uvVoltage: 0.489,
  level: 'BAJO',
  luminosity: 120,
  temperature: 25,
  humidity: 60,
  pressure: 1013,
  presence: false,
  dateTime: '2026-11-04 12:00:00',
  receivedAt: '2026-11-04T17:00:00.000Z'
}
const input = {
  name: 'Prueba',
  location: '',
  description: '',
  mode: 'manual',
  durationSeconds: null,
  storageIntervalSeconds: 10,
  startedAt: measurement.receivedAt
}

function database({ failCount = false, gate = null, status = 'ACTIVA' } = {}) {
  const calls = []
  const connection = {
    beginTransaction: async () => {
      calls.push('begin')
    },
    execute: async (sql) => {
      if (sql.startsWith('SELECT')) {
        calls.push('lock')
        return [[{ estado: status }]]
      }
      if (sql.includes('INSERT INTO')) {
        calls.push('insert')
        if (gate) await gate.promise
        return [{ insertId: 8 }]
      }
      calls.push('count')
      if (failCount) throw new Error('simulated update failure')
      return [{ affectedRows: 1 }]
    },
    commit: async () => {
      calls.push('commit')
    },
    rollback: async () => {
      calls.push('rollback')
    },
    release: () => {
      calls.push('release')
    }
  }
  const pool = {
    getConnection: async () => connection,
    execute: async (sql) => {
      calls.push(sql.includes('INSERT INTO') ? 'session' : 'finish')
      return [{ insertId: 1, affectedRows: 1 }]
    },
    end: async () => {
      calls.push('end')
    }
  }
  const { DatabaseService } = load('src/main/database/DatabaseService.ts', {
    'mysql2/promise': { createPool: () => pool },
    './databaseConfig': { loadDatabaseConfig: () => ({}) }
  })
  return { service: new DatabaseService(), calls }
}

test('measurement and count commit in the same locked transaction', async () => {
  const { service, calls } = database()
  assert.equal(await service.saveMeasurement({ sessionId: 1, measurement }), 8)
  assert.deepEqual(calls, ['begin', 'lock', 'insert', 'count', 'commit', 'release'])
})

test('count failure rolls back the insertion and releases the connection', async () => {
  const { service, calls } = database({ failCount: true })
  await assert.rejects(service.saveMeasurement({ sessionId: 1, measurement }))
  assert.deepEqual(calls, ['begin', 'lock', 'insert', 'count', 'rollback', 'release'])
})

test('closed sessions reject writes', async () => {
  const { service, calls } = database({ status: 'FINALIZADA' })
  await assert.rejects(service.saveMeasurement({ sessionId: 1, measurement }))
  assert.deepEqual(calls, ['begin', 'lock', 'rollback', 'release'])
})

test('finish and application shutdown wait for an outstanding write', async () => {
  const gate = deferred()
  const { service, calls } = database({ gate })
  await service.createSession(input)
  const save = service.saveMeasurement({ sessionId: 1, measurement })
  const finish = service.finishSession(1, measurement.receivedAt)
  const close = service.close()
  await tick()
  assert.equal(calls.includes('finish'), false)
  await assert.rejects(service.saveMeasurement({ sessionId: 1, measurement }))
  gate.resolve()
  await Promise.all([save, finish, close])
  assert.ok(calls.indexOf('commit') < calls.indexOf('finish'))
  assert.equal(calls.at(-1), 'end')
})

test('shutdown finalizes sessions created by this instance', async () => {
  const { service, calls } = database()
  await service.createSession(input)
  await service.close()
  assert.deepEqual(calls, ['session', 'finish', 'end'])
})

test('closing a macOS window can finalize captures without disabling future sessions', async () => {
  const { service, calls } = database()
  await service.createSession(input)
  await service.finishOpenSessions()
  await service.createSession(input)
  assert.deepEqual(calls, ['session', 'finish', 'session'])
})

test('statistics handle 200000 readings, nulls and non-finite values', () => {
  const { service } = database()
  const rows = Array.from({ length: 200000 }, (_, index) => ({ uvVoltage: index }))
  rows.push({ uvVoltage: null }, { uvVoltage: Infinity }, { uvVoltage: NaN })
  const stats = service.calculateStats(rows)
  assert.equal(stats.uvMin, 0)
  assert.equal(stats.uvMax, 199999)
  assert.equal(stats.uvAvg, 99999.5)
  assert.equal(stats.temperatureAvg, null)
})

function serial() {
  const { SerialService } = load('src/main/serial/SerialService.ts', { serialport: {} })
  const service = new SerialService()
  const readings = []
  service.on('measurement', (reading) => readings.push(reading))
  return { service, readings }
}
const lines = [
  'UV ADC: 100 | Voltaje: 0.489 V',
  'Nivel: BAJO',
  'Luz: 120.0 lux',
  'Temperatura: 25.0 C',
  'Humedad: 60.0 %',
  'Presion: 1013.0 hPa',
  'Presencia: NO DETECTADA',
  'Fecha y hora: 2026-11-04 12:00:00'
]
test('serial parser accepts a full frame and reordered middle fields', () => {
  const { service, readings } = serial()
  for (const line of [lines[0], ...lines.slice(1, -1).reverse(), lines.at(-1)])
    service.processLine(line)
  assert.equal(readings.length, 1)
  assert.equal(readings[0].presence, false)
  assert.equal(readings[0].temperature, 25)
})
test('serial parser discards partial, malformed and duplicate frames, then recovers', () => {
  const { service, readings } = serial()
  for (const line of lines.filter((_, index) => index !== 4)) service.processLine(line)
  for (const line of lines.map((line, index) => (index === 3 ? 'Temperatura: 1.2.3 C' : line)))
    service.processLine(line)
  for (const line of [lines[0], lines[1], ...lines.slice(1)]) service.processLine(line)
  assert.equal(readings.length, 0)
  for (const line of lines) service.processLine(line)
  assert.equal(readings.length, 1)
})
test('a new UV header or expired frame cannot reuse old sensor values', () => {
  const { service, readings } = serial()
  for (const line of lines.slice(0, -1)) service.processLine(line)
  service.processLine(lines[0])
  service.processLine(lines.at(-1))
  for (const line of lines.slice(0, -1)) service.processLine(line)
  service.frameStartedAt = Date.now() - 11000
  service.processLine(lines.at(-1))
  assert.equal(readings.length, 0)
})

function renderer(api) {
  const slots = []
  let cursor = 0
  let mounted = false
  const effects = []
  let onMeasurement, onDisconnected
  let timerCallback
  let offset = 0
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState: (initial) => {
      const index = cursor++
      if (!mounted) slots[index] = initial
      return [
        slots[index],
        (value) => {
          slots[index] = typeof value === 'function' ? value(slots[index]) : value
        }
      ]
    },
    useRef: (initial) => {
      const index = cursor++
      if (!mounted) slots[index] = { current: initial }
      return slots[index]
    },
    useMemo: (factory) => factory(),
    useEffect: (effect) => {
      effects.push(effect)
    }
  }
  const { AppProvider } = load(
    'src/renderer/src/context/AppContext.tsx',
    {
      react,
      'react/jsx-runtime': { jsx: (_type, props) => props.value }
    },
    {
      crypto: require('node:crypto').webcrypto,
      Date: class extends Date {
        static now() {
          return Date.now() + offset
        }
      },
      window: {
        setInterval: (callback) => {
          timerCallback = callback
          return 1
        },
        clearInterval: () => {},
        api: {
          serial: {
            getState: async () => ({ success: true, data: { connected: true, path: 'COM1' } }),
            onMeasurement: (callback) => {
              onMeasurement = callback
              return () => {}
            },
            onDisconnected: (callback) => {
              onDisconnected = callback
              return () => {}
            },
            onConnectionError: () => () => {}
          },
          database: api
        }
      }
    }
  )
  const render = () => {
    cursor = 0
    effects.length = 0
    const value = AppProvider({ children: null })
    mounted = true
    return value
  }
  render()
  effects[0]()
  return {
    render,
    startTimer: () => effects[1](),
    advance: (seconds) => {
      offset += seconds * 1000
      timerCallback()
    },
    emit: () => onMeasurement(measurement),
    disconnect: () => onDisconnected()
  }
}
test('renderer retries next sample after failure and counts only confirmed writes', async () => {
  let saves = 0
  const app = renderer({
    createSession: async () => ({ success: true, data: { sessionId: 1 } }),
    saveMeasurement: async () => ({ success: ++saves > 1 })
  })
  await tick()
  await app.render().startCapture(input)
  app.emit()
  await tick()
  assert.equal(app.render().savedMeasurements, 0)
  app.emit()
  await tick()
  app.emit()
  await tick()
  assert.equal(saves, 2)
  assert.equal(app.render().savedMeasurements, 1)
})
test('renderer waits for pending save, blocks duplicate starts and finalizes on disconnect', async () => {
  const gate = deferred()
  let saves = 0,
    finishes = 0
  const app = renderer({
    createSession: async () => ({ success: true, data: { sessionId: 1 } }),
    saveMeasurement: async () => {
      saves++
      await gate.promise
      return { success: true }
    },
    finishSession: async () => {
      finishes++
      return { success: true }
    }
  })
  await tick()
  assert.equal(await app.render().startCapture(input), true)
  assert.equal(await app.render().startCapture(input), false)
  app.emit()
  app.emit()
  app.disconnect()
  const stop = app.render().stopCapture()
  await tick()
  assert.equal(saves, 1)
  assert.equal(finishes, 0)
  app.emit()
  gate.resolve()
  await stop
  assert.equal(finishes, 1)
  assert.equal(app.render().savedMeasurements, 1)
  assert.equal(app.render().activeSession.status, 'finished')
})

test('configuration errors and database errors never include supplied secrets', () => {
  const { loadDatabaseConfig } = load('src/main/database/databaseConfig.ts', {
    electron: { app: { getPath: () => 'private' } },
    'node:fs': { readFileSync: () => '{private-secret' }
  })
  assert.throws(loadDatabaseConfig, (error) => !error.message.includes('private-secret'))
  const validation = load('src/main/ipc/validation.ts', {
    electron: { ipcMain: {} },
    '@electron-toolkit/utils': { is: { dev: false } }
  })
  assert.equal(validation.validId('1'), false)
  assert.equal(validation.validId(Infinity), false)
  assert.equal(validation.validDate('invalid'), false)
  assert.equal(validation.validDate('2026-02-31T12:00:00.000Z'), false)
  assert.throws(() => validation.validIds([1, '2']))
  assert.equal(
    validation.safeDatabaseError(new Error('private-secret')).includes('private-secret'),
    false
  )
})

test('database configuration uses the explicit external path and only supported pool options', () => {
  let selectedPath
  const { loadDatabaseConfig } = load(
    'src/main/database/databaseConfig.ts',
    {
      electron: { app: { getPath: () => 'user-data' } },
      'node:fs': {
        readFileSync: (path) => {
          selectedPath = path
          return JSON.stringify({
            host: '127.0.0.1',
            port: 3306,
            user: 'test-user',
            password: '',
            database: 'monitor_uv',
            arbitrary: true
          })
        }
      }
    },
    { process: { env: { MONITOR_UV_DB_CONFIG: 'external/database.json' } } }
  )
  const options = loadDatabaseConfig()
  assert.equal(selectedPath, 'external/database.json')
  assert.equal(options.database, 'monitor_uv')
  assert.equal(options.port, 3306)
  assert.equal(options.arbitrary, undefined)
})

test('database configuration falls back to userData and rejects an invalid port', () => {
  let selectedPath
  const { loadDatabaseConfig } = load(
    'src/main/database/databaseConfig.ts',
    {
      electron: { app: { getPath: () => 'user-data' } },
      'node:fs': {
        readFileSync: (path) => {
          selectedPath = path
          return JSON.stringify({
            host: '127.0.0.1',
            port: 70000,
            user: 'test-user',
            password: '',
            database: 'monitor_uv'
          })
        }
      }
    },
    { process: { env: {} } }
  )
  assert.throws(loadDatabaseConfig)
  assert.equal(selectedPath, require('node:path').join('user-data', 'database.json'))
})

test('timed capture finishes after wall-clock duration while manual capture remains active', async () => {
  for (const mode of ['timed', 'manual']) {
    let finishes = 0
    const app = renderer({
      createSession: async () => ({ success: true, data: { sessionId: 1 } }),
      finishSession: async () => {
        finishes++
        return { success: true }
      }
    })
    await tick()
    await app
      .render()
      .startCapture({ ...input, mode, durationSeconds: mode === 'timed' ? 10 : null })
    app.render()
    app.startTimer()
    app.advance(15)
    await tick()
    assert.equal(finishes, mode === 'timed' ? 1 : 0)
    assert.equal(app.render().capturing, mode === 'manual')
  }
})

test('failed finalization preserves the session and can be retried', async () => {
  let finishes = 0
  const app = renderer({
    createSession: async () => ({ success: true, data: { sessionId: 1 } }),
    finishSession: async () => ({ success: ++finishes > 1 })
  })
  await tick()
  await app.render().startCapture(input)
  await app.render().stopCapture()
  assert.equal(app.render().activeSession.status, 'active')
  app.render().clearSession()
  assert.equal(app.render().activeSession.status, 'active')
  await app.render().stopCapture()
  assert.equal(app.render().activeSession.status, 'finished')
})

test('disconnect during session creation finalizes it without starting capture', async () => {
  const gate = deferred()
  let finishes = 0
  const app = renderer({
    createSession: async () => {
      await gate.promise
      return { success: true, data: { sessionId: 1 } }
    },
    finishSession: async () => {
      finishes++
      return { success: true }
    }
  })
  await tick()
  const starting = app.render().startCapture(input)
  app.disconnect()
  gate.resolve()
  assert.equal(await starting, false)
  assert.equal(finishes, 1)
  assert.equal(app.render().capturing, false)
})

test('IPC handlers reject malformed data before accessing database services', async () => {
  const handlers = new Map()
  let calls = 0
  const validation = load('src/main/ipc/validation.ts', {
    electron: { ipcMain: {} },
    '@electron-toolkit/utils': { is: { dev: false } }
  })
  const { registerDatabaseHandlers } = load('src/main/ipc/databaseHandlers.ts', {
    './validation': { ...validation, handle: (name, callback) => handlers.set(name, callback) },
    '../database/DatabaseService': {
      databaseService: new Proxy(
        {},
        {
          get: () => () => {
            calls++
          }
        }
      )
    },
    '../reports/ReportExportService': { reportExportService: {} }
  })
  registerDatabaseHandlers()
  for (const name of [
    'create-session',
    'save-measurement',
    'finish-session',
    'cancel-session',
    'get-session-detail',
    'get-report',
    'export-report-csv',
    'export-report-pdf'
  ]) {
    const result = await handlers.get(`database:${name}`)({}, null)
    assert.equal(result.success, false, name)
  }
  assert.equal(calls, 0)
})

test('serial operations are serialized and release port listeners on close', async () => {
  const { EventEmitter } = require('node:events')
  const ports = []
  class Port extends EventEmitter {
    isOpen = false
    constructor(options) {
      super()
      this.path = options.path
      ports.push(this)
    }
    pipe(parser) {
      this.parser = parser
      return parser
    }
    unpipe() {
      return this
    }
    open(callback) {
      queueMicrotask(() => {
        this.isOpen = true
        callback(null)
      })
    }
    close(callback) {
      this.isOpen = false
      this.emit('close')
      callback(null)
    }
  }
  const { SerialService } = load('src/main/serial/SerialService.ts', {
    serialport: { SerialPort: Port, ReadlineParser: EventEmitter }
  })
  const service = new SerialService()
  await Promise.all([service.connect('COM1'), service.connect('COM2')])
  assert.equal(ports[0].isOpen, false)
  assert.equal(ports[0].parser.listenerCount('data'), 0)
  assert.equal(service.getConnectionState().path, 'COM2')
  await service.disconnect()
  assert.equal(service.getConnectionState().connected, false)
  assert.equal(ports[1].parser.listenerCount('data'), 0)
})

test('CSV escapes formulas and quotes; PDF HTML escapes user text with sandbox and no JS', async () => {
  const files = []
  let html,
    preferences,
    destroyed = false
  const { reportExportService } = load('src/main/reports/ReportExportService.ts', {
    electron: {
      dialog: { showSaveDialog: async () => ({ filePath: 'test', canceled: false }) },
      BrowserWindow: class {
        constructor(options) {
          preferences = options.webPreferences
        }
        async loadURL(url) {
          html = decodeURIComponent(url.split(',').slice(1).join(','))
        }
        webContents = { printToPDF: async () => Buffer.from('simulated') }
        destroy() {
          destroyed = true
        }
      }
    },
    'node:fs/promises': {
      writeFile: async (_path, content) => {
        files.push(content)
      }
    }
  })
  const { service } = database()
  const report = {
    sessions: [
      {
        sessionId: 1,
        name: '=1+1',
        location: 'a;"b',
        description: '<script>alert(1)</script>',
        totalSamples: 1
      }
    ],
    measurements: [{ ...measurement, sessionId: 1, measurementId: 1 }],
    stats: service.calculateStats([measurement])
  }
  await reportExportService.exportCsv(report)
  assert.ok(files[0].includes("'=1+1"))
  assert.ok(files[0].includes('"a;""b"'))
  await reportExportService.exportPdf(report)
  assert.ok(html.includes('&lt;script&gt;'))
  assert.equal(html.includes('<script>'), false)
  assert.equal(preferences.sandbox, true)
  assert.equal(preferences.javascript, false)
  assert.equal(destroyed, true)
})
