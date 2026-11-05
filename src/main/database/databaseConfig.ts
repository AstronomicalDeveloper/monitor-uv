import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PoolOptions } from 'mysql2/promise'

// Runtime configuration stays outside the installed application and its ASAR.
export function loadDatabaseConfig(): PoolOptions {
  const path = process.env.MONITOR_UV_DB_CONFIG || join(app.getPath('userData'), 'database.json')
  let config: Record<string, unknown>
  try {
    config = JSON.parse(readFileSync(path, 'utf8'))
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error()
  } catch {
    throw new Error('Configura database.json en los datos de usuario o MONITOR_UV_DB_CONFIG.')
  }
  if (
    !['host', 'user', 'database'].every(
      (key) => typeof config[key] === 'string' && String(config[key]).trim()
    ) ||
    typeof config.password !== 'string' ||
    !Number.isInteger(config.port) ||
    Number(config.port) < 1 ||
    Number(config.port) > 65535
  ) {
    throw new Error('La configuracion de MariaDB no es valida.')
  }
  return {
    host: config.host as string,
    port: config.port as number,
    user: config.user as string,
    password: config.password,
    database: config.database as string,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    dateStrings: true
  }
}
