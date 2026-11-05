import mysql from 'mysql2/promise'
import { loadDatabaseConfig } from './databaseConfig'

type CaptureMode = 'manual' | 'timed'

type Measurement = {
  uvAdc: number | null
  uvVoltage: number | null
  level: 'BAJO' | 'MEDIO' | 'ALTO' | null
  luminosity: number | null
  temperature: number | null
  humidity: number | null
  pressure: number | null
  presence: boolean | null
  dateTime: string | null
  receivedAt: string | null
}

interface CreateSessionRequest {
  name: string
  location: string
  description: string
  mode: CaptureMode
  durationSeconds: number | null
  storageIntervalSeconds: number
  startedAt: string
}

interface SaveMeasurementRequest {
  sessionId: number
  measurement: Measurement
}

function toSqlDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const pad = (number: number, size = 2): string => number.toString().padStart(size, '0')

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds()),
    '.',
    pad(date.getMilliseconds(), 3)
  ].join('')
}

function normalizeMode(mode: string): CaptureMode {
  return mode === 'TEMPORIZADA' ? 'timed' : 'manual'
}

function normalizeStatus(status: string): 'active' | 'finished' | 'cancelled' {
  if (status === 'FINALIZADA') {
    return 'finished'
  }

  if (status === 'CANCELADA') {
    return 'cancelled'
  }

  return 'active'
}

function numberOrNull(value: unknown): number | null {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !value.trim())
  ) {
    return null
  }

  const number = Number(value)
  return !Number.isFinite(number) ? null : number
}

export class DatabaseService {
  private pool: mysql.Pool | null = null
  private writes: Promise<unknown> = Promise.resolve()
  private closing = false
  private openSessions = new Set<number>()

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closing) return Promise.reject(new Error('La aplicacion se esta cerrando.'))
    const pending = this.writes.then(operation)
    this.writes = pending.catch(() => undefined)
    return pending
  }

  createSession(request: CreateSessionRequest): Promise<number> {
    return this.enqueue(() => this.insertSession(request))
  }

  saveMeasurement(request: SaveMeasurementRequest): Promise<number> {
    return this.enqueue(() => this.insertMeasurement(request))
  }

  finishSession(sessionId: number, finishedAt: string): Promise<void> {
    return this.enqueue(() => this.updateSession(sessionId, finishedAt, 'FINALIZADA'))
  }

  cancelSession(sessionId: number, finishedAt: string): Promise<void> {
    return this.enqueue(() => this.updateSession(sessionId, finishedAt, 'CANCELADA'))
  }

  finishOpenSessions(): Promise<void> {
    return this.enqueue(() => this.finalizeOpenSessions())
  }

  private async finalizeOpenSessions(): Promise<void> {
    for (const id of this.openSessions) {
      await this.updateSession(id, new Date().toISOString(), 'FINALIZADA')
    }
  }

  private getPool(): mysql.Pool {
    if (!this.pool) {
      this.pool = mysql.createPool(loadDatabaseConfig())
    }

    return this.pool
  }

  async testConnection(): Promise<boolean> {
    const pool = this.getPool()
    const [rows] = await pool.query('SELECT 1 AS result')

    return Array.isArray(rows)
  }

  private async insertSession(request: CreateSessionRequest): Promise<number> {
    const pool = this.getPool()

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO sesion_medicion (
        nombre,
        lugar,
        descripcion,
        modo_finalizacion,
        duracion_programada_segundos,
        frecuencia_almacenamiento_segundos,
        fecha_inicio,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVA')`,
      [
        request.name,
        request.location || null,
        request.description || null,
        request.mode === 'timed' ? 'TEMPORIZADA' : 'MANUAL',
        request.mode === 'timed' ? request.durationSeconds : null,
        request.storageIntervalSeconds,
        toSqlDateTime(request.startedAt)
      ]
    )

    this.openSessions.add(result.insertId)
    return result.insertId
  }

  private async insertMeasurement(request: SaveMeasurementRequest): Promise<number> {
    const pool = this.getPool()
    const { sessionId, measurement } = request

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [sessions] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT estado FROM sesion_medicion WHERE sesion_id = ? FOR UPDATE',
        [sessionId]
      )
      if (sessions[0]?.estado !== 'ACTIVA') throw new Error('La sesion no esta activa.')
      const [result] = await connection.execute<mysql.ResultSetHeader>(
        `INSERT INTO medicion_ambiental (
        sesion_id,
        fecha_hora_prototipo,
        fecha_hora_recepcion,
        uv_adc,
        voltaje_uv,
        nivel_uv,
        luminosidad_lux,
        temperatura_c,
        humedad_porcentaje,
        presion_hpa,
        presencia_detectada
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          measurement.dateTime,
          toSqlDateTime(measurement.receivedAt) ?? toSqlDateTime(new Date().toISOString()),
          measurement.uvAdc,
          measurement.uvVoltage,
          measurement.level,
          measurement.luminosity,
          measurement.temperature,
          measurement.humidity,
          measurement.pressure,
          measurement.presence === null ? null : measurement.presence ? 1 : 0
        ]
      )

      await connection.execute(
        `UPDATE sesion_medicion
       SET total_muestras = total_muestras + 1
       WHERE sesion_id = ?`,
        [sessionId]
      )

      await connection.commit()
      return result.insertId
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  private async updateSession(
    sessionId: number,
    finishedAt: string,
    status: 'FINALIZADA' | 'CANCELADA'
  ): Promise<void> {
    await this.getPool().execute(
      `UPDATE sesion_medicion SET estado = ?, fecha_fin = ?
       WHERE sesion_id = ? AND estado = 'ACTIVA'`,
      [status, toSqlDateTime(finishedAt), sessionId]
    )
    this.openSessions.delete(sessionId)
  }

  async listSessions(): Promise<unknown[]> {
    const pool = this.getPool()
    const [rows] = await pool.query(
      `SELECT
        s.sesion_id AS sessionId,
        s.nombre AS name,
        s.lugar AS location,
        s.descripcion AS description,
        s.modo_finalizacion AS mode,
        s.duracion_programada_segundos AS durationSeconds,
        s.frecuencia_almacenamiento_segundos AS storageIntervalSeconds,
        s.fecha_inicio AS startedAt,
        s.fecha_fin AS finishedAt,
        s.estado AS status,
        s.total_muestras AS totalSamples,
        MAX(m.voltaje_uv) AS uvMax,
        AVG(m.voltaje_uv) AS uvAvg,
        AVG(m.temperatura_c) AS temperatureAvg,
        AVG(m.luminosidad_lux) AS luminosityAvg
      FROM sesion_medicion s
      LEFT JOIN medicion_ambiental m ON m.sesion_id = s.sesion_id
      GROUP BY s.sesion_id
      ORDER BY s.fecha_inicio DESC`
    )

    return (rows as Record<string, unknown>[]).map((row) => ({
      ...row,
      mode: normalizeMode(String(row.mode)),
      status: normalizeStatus(String(row.status)),
      durationSeconds: numberOrNull(row.durationSeconds),
      storageIntervalSeconds: Number(row.storageIntervalSeconds),
      totalSamples: Number(row.totalSamples ?? 0),
      uvMax: numberOrNull(row.uvMax),
      uvAvg: numberOrNull(row.uvAvg),
      temperatureAvg: numberOrNull(row.temperatureAvg),
      luminosityAvg: numberOrNull(row.luminosityAvg)
    }))
  }

  async getSessionDetail(sessionId: number): Promise<unknown> {
    const sessions = await this.listSessions()
    const session = (sessions as Record<string, unknown>[]).find(
      (item) => Number(item.sessionId) === sessionId
    )

    if (!session) {
      throw new Error('No se encontró la sesión solicitada.')
    }

    const measurements = await this.listMeasurementsBySessions([sessionId])
    const stats = this.calculateStats(measurements as Record<string, unknown>[])

    return {
      session,
      stats,
      measurements
    }
  }

  async listMeasurementsBySessions(sessionIds: number[]): Promise<unknown[]> {
    if (sessionIds.length === 0) {
      return []
    }

    const pool = this.getPool()
    const placeholders = sessionIds.map(() => '?').join(',')
    const [rows] = await pool.execute(
      `SELECT
        medicion_id AS measurementId,
        sesion_id AS sessionId,
        fecha_hora_prototipo AS dateTime,
        fecha_hora_recepcion AS receivedAt,
        uv_adc AS uvAdc,
        voltaje_uv AS uvVoltage,
        nivel_uv AS level,
        luminosidad_lux AS luminosity,
        temperatura_c AS temperature,
        humedad_porcentaje AS humidity,
        presion_hpa AS pressure,
        presencia_detectada AS presence
      FROM medicion_ambiental
      WHERE sesion_id IN (${placeholders})
      ORDER BY fecha_hora_recepcion ASC`,
      sessionIds
    )

    return (rows as Record<string, unknown>[]).map((row) => ({
      measurementId: Number(row.measurementId),
      sessionId: Number(row.sessionId),
      dateTime: row.dateTime as string | null,
      receivedAt: row.receivedAt as string | null,
      uvAdc: numberOrNull(row.uvAdc),
      uvVoltage: numberOrNull(row.uvVoltage),
      level: row.level as string | null,
      luminosity: numberOrNull(row.luminosity),
      temperature: numberOrNull(row.temperature),
      humidity: numberOrNull(row.humidity),
      pressure: numberOrNull(row.pressure),
      presence:
        row.presence === null || row.presence === undefined ? null : Number(row.presence) === 1
    }))
  }

  async getReport(sessionIds: number[]): Promise<unknown> {
    const allSessions = (await this.listSessions()) as Record<string, unknown>[]
    const sessions = allSessions.filter((session) => sessionIds.includes(Number(session.sessionId)))

    if (sessions.length === 0) {
      throw new Error('Selecciona al menos una sesión válida.')
    }

    const measurements = await this.listMeasurementsBySessions(sessionIds)
    const stats = this.calculateStats(measurements as Record<string, unknown>[])

    return {
      sessionIds,
      sessions,
      stats,
      measurements
    }
  }

  private calculateStats(measurements: Record<string, unknown>[]): Record<string, unknown> {
    const values = (key: string): number[] =>
      measurements
        .map((measurement) => numberOrNull(measurement[key]))
        .filter((value): value is number => value !== null)

    const min = (numbers: number[]): number | null =>
      numbers.length ? numbers.reduce((result, value) => Math.min(result, value), Infinity) : null

    const max = (numbers: number[]): number | null =>
      numbers.length ? numbers.reduce((result, value) => Math.max(result, value), -Infinity) : null

    const avg = (numbers: number[]): number | null =>
      numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null

    const uvValues = values('uvVoltage')
    const tempValues = values('temperature')
    const humidityValues = values('humidity')
    const pressureValues = values('pressure')
    const luminosityValues = values('luminosity')
    const presenceCount = measurements.filter((measurement) => measurement.presence === true).length

    return {
      samples: measurements.length,
      uvMin: min(uvValues),
      uvMax: max(uvValues),
      uvAvg: avg(uvValues),
      temperatureMin: min(tempValues),
      temperatureMax: max(tempValues),
      temperatureAvg: avg(tempValues),
      humidityMin: min(humidityValues),
      humidityMax: max(humidityValues),
      humidityAvg: avg(humidityValues),
      pressureMin: min(pressureValues),
      pressureMax: max(pressureValues),
      pressureAvg: avg(pressureValues),
      luminosityMin: min(luminosityValues),
      luminosityMax: max(luminosityValues),
      luminosityAvg: avg(luminosityValues),
      presenceCount
    }
  }

  async close(): Promise<void> {
    this.closing = true
    await this.writes
    try {
      await this.finalizeOpenSessions()
    } finally {
      await this.pool?.end()
      this.pool = null
    }
  }
}

export const databaseService = new DatabaseService()
