import { EventEmitter } from 'node:events'
import { SerialPort, ReadlineParser } from 'serialport'

export interface ParsedMeasurement {
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

type PartialMeasurement = Partial<ParsedMeasurement>

export class SerialService extends EventEmitter {
  private port: SerialPort | null = null
  private connectedPortPath: string | null = null
  private currentMeasurement: PartialMeasurement = {}
  private frameStartedAt = 0
  private operations: Promise<unknown> = Promise.resolve()

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.operations.then(operation)
    this.operations = pending.catch(() => undefined)
    return pending
  }

  testConnection(
    path: string,
    baudRate = 9600
  ): Promise<{ path: string; baudRate: number; firstLine: string }> {
    return this.enqueue(() => {
      if (this.port?.isOpen) throw new Error('Desconecta el dispositivo antes de probar el puerto.')
      return this.testPort(path, baudRate)
    })
  }

  connect(
    path: string,
    baudRate = 9600
  ): Promise<{ path: string; baudRate: number; alreadyConnected: boolean }> {
    return this.enqueue(() => this.connectPort(path, baudRate))
  }

  disconnect(): Promise<void> {
    return this.enqueue(() => this.disconnectPort())
  }

  async listPorts(): Promise<
    Array<{
      path: string
      manufacturer: string | null
      serialNumber: string | null
      vendorId: string | null
      productId: string | null
      pnpId: string | null
    }>
  > {
    try {
      const ports = await SerialPort.list()

      return ports.map((port) => ({
        path: port.path,
        manufacturer: port.manufacturer ?? null,
        serialNumber: port.serialNumber ?? null,
        vendorId: port.vendorId ?? null,
        productId: port.productId ?? null,
        pnpId: port.pnpId ?? null
      }))
    } catch (error) {
      console.error('Error al listar puertos seriales:', error)

      throw new Error('No se pudieron obtener los puertos seriales disponibles.')
    }
  }

  private async testPort(
    path: string,
    baudRate = 9600
  ): Promise<{
    path: string
    baudRate: number
    firstLine: string
  }> {
    if (!path) {
      throw new Error('Debes seleccionar un puerto serial.')
    }

    return new Promise((resolve, reject) => {
      const testPort = new SerialPort({
        path,
        baudRate,
        autoOpen: false
      })

      const parser = testPort.pipe(
        new ReadlineParser({
          delimiter: '\n'
        })
      )

      let finished = false

      const finish = (callback: () => void): void => {
        if (finished) {
          return
        }

        finished = true
        clearTimeout(timeoutId)
        parser.removeAllListeners()

        if (testPort.isOpen) {
          testPort.close(() => callback())
        } else {
          callback()
        }
      }

      const timeoutId = setTimeout(() => {
        finish(() => {
          reject(new Error('El puerto se abrió, pero no se recibieron datos del prototipo.'))
        })
      }, 8000)

      parser.on('data', (data: Buffer | string) => {
        const line = data.toString().trim()

        if (!line) {
          return
        }

        finish(() => {
          resolve({
            path,
            baudRate,
            firstLine: line
          })
        })
      })

      testPort.once('error', (error) => {
        finish(() => {
          reject(new Error(this.getFriendlySerialError(error)))
        })
      })

      testPort.open((error) => {
        if (!error && finished && testPort.isOpen) {
          testPort.close(() => undefined)
          return
        }
        if (error) {
          finish(() => {
            reject(new Error(this.getFriendlySerialError(error)))
          })
        }
      })
    })
  }

  private async connectPort(
    path: string,
    baudRate = 9600
  ): Promise<{
    path: string
    baudRate: number
    alreadyConnected: boolean
  }> {
    if (!path) {
      throw new Error('Debes seleccionar un puerto serial.')
    }

    if (this.port?.isOpen) {
      if (this.connectedPortPath === path) {
        return {
          path,
          baudRate,
          alreadyConnected: true
        }
      }

      await this.disconnectPort()
    }

    return new Promise((resolve, reject) => {
      const port = new SerialPort({
        path,
        baudRate,
        autoOpen: false
      })

      const parser = port.pipe(
        new ReadlineParser({
          delimiter: '\n'
        })
      )

      port.on('error', (error) => {
        if (this.port !== port) reject(new Error(this.getFriendlySerialError(error)))
      })
      port.open((error) => {
        if (error) {
          reject(new Error(this.getFriendlySerialError(error)))
          return
        }

        this.port = port
        this.connectedPortPath = path
        this.currentMeasurement = {}

        parser.on('data', (data: Buffer | string) => {
          const line = data.toString().trim()

          if (line) {
            this.processLine(line)
          }
        })

        port.on('error', (serialError) => {
          console.error('Error durante la conexión serial:', serialError)

          this.emit('connection-error', {
            message: this.getFriendlySerialError(serialError)
          })
        })

        port.on('close', () => {
          port.unpipe(parser)
          parser.removeAllListeners()
          if (this.port !== port) return
          const disconnectedPath = this.connectedPortPath

          this.port = null
          this.connectedPortPath = null
          this.currentMeasurement = {}

          this.emit('disconnected', {
            path: disconnectedPath
          })
        })

        this.emit('connected', {
          path,
          baudRate
        })

        resolve({
          path,
          baudRate,
          alreadyConnected: false
        })
      })
    })
  }

  processLine(line: string): void {
    if (line.length > 512) {
      this.currentMeasurement = {}
      return
    }
    this.emit('raw-line', line)
    if (Date.now() - this.frameStartedAt > 10000) this.currentMeasurement = {}

    const uvMatch = line.match(/UV\s*ADC:\s*(-?\d+)\s*\|\s*Voltaje:\s*(-?[\d.]+)\s*V/i)

    if (uvMatch) {
      this.currentMeasurement = {}
      this.frameStartedAt = Date.now()
      this.currentMeasurement.uvAdc = Number(uvMatch[1])
      this.currentMeasurement.uvVoltage = Number(uvMatch[2])
      return
    }

    const levelMatch = line.match(/Nivel:\s*(BAJO|MEDIO|ALTO)/i)

    if (levelMatch) {
      if (this.currentMeasurement.level !== undefined) {
        this.currentMeasurement = {}
        return
      }
      this.currentMeasurement.level = levelMatch[1].toUpperCase() as 'BAJO' | 'MEDIO' | 'ALTO'

      return
    }

    const luminosityMatch = line.match(/Luz:\s*(-?[\d.]+)\s*lux/i)

    if (luminosityMatch) {
      if (this.currentMeasurement.luminosity !== undefined) {
        this.currentMeasurement = {}
        return
      }
      this.currentMeasurement.luminosity = Number(luminosityMatch[1])
      return
    }

    const temperatureMatch = line.match(/Temperatura:\s*(-?[\d.]+)\s*(?:°?\s*C)?/i)

    if (temperatureMatch) {
      if (this.currentMeasurement.temperature !== undefined) {
        this.currentMeasurement = {}
        return
      }
      this.currentMeasurement.temperature = Number(temperatureMatch[1])
      return
    }

    const humidityMatch = line.match(/Humedad:\s*(-?[\d.]+)\s*%/i)

    if (humidityMatch) {
      if (this.currentMeasurement.humidity !== undefined) {
        this.currentMeasurement = {}
        return
      }
      this.currentMeasurement.humidity = Number(humidityMatch[1])
      return
    }

    const pressureMatch = line.match(/Presi[oó]n:\s*(-?[\d.]+)\s*hPa/i)

    if (pressureMatch) {
      if (this.currentMeasurement.pressure !== undefined) {
        this.currentMeasurement = {}
        return
      }
      this.currentMeasurement.pressure = Number(pressureMatch[1])
      return
    }

    const presenceMatch = line.match(/Presencia:\s*(DETECTADA|NO\s+DETECTADA)/i)

    if (presenceMatch) {
      if (this.currentMeasurement.presence !== undefined) {
        this.currentMeasurement = {}
        return
      }
      this.currentMeasurement.presence =
        presenceMatch[1].replace(/\s+/g, ' ').toUpperCase() === 'DETECTADA'

      return
    }

    const dateTimeMatch = line.match(/Fecha\s+y\s+hora:\s*(.+)$/i)

    if (dateTimeMatch) {
      this.currentMeasurement.dateTime = dateTimeMatch[1].trim()

      const measurement: ParsedMeasurement = {
        uvAdc: this.currentMeasurement.uvAdc ?? null,
        uvVoltage: this.currentMeasurement.uvVoltage ?? null,
        level: this.currentMeasurement.level ?? null,
        luminosity: this.currentMeasurement.luminosity ?? null,
        temperature: this.currentMeasurement.temperature ?? null,
        humidity: this.currentMeasurement.humidity ?? null,
        pressure: this.currentMeasurement.pressure ?? null,
        presence: this.currentMeasurement.presence ?? null,
        dateTime: this.currentMeasurement.dateTime ?? null,
        receivedAt: new Date().toISOString()
      }

      const numeric = [
        measurement.uvAdc,
        measurement.uvVoltage,
        measurement.luminosity,
        measurement.temperature,
        measurement.humidity,
        measurement.pressure
      ]
      if (
        numeric.every((value) => typeof value === 'number' && Number.isFinite(value)) &&
        measurement.uvAdc! >= 0 &&
        measurement.uvVoltage! >= 0 &&
        measurement.luminosity! >= 0 &&
        measurement.humidity! >= 0 &&
        measurement.humidity! <= 100 &&
        measurement.pressure! > 0 &&
        measurement.level !== null &&
        measurement.presence !== null &&
        measurement.dateTime!.length <= 30
      ) {
        this.emit('measurement', measurement)
      }
      this.currentMeasurement = {}
    }
  }

  private async disconnectPort(): Promise<void> {
    if (!this.port?.isOpen) {
      this.port = null
      this.connectedPortPath = null
      this.currentMeasurement = {}
      return
    }

    const portToClose = this.port

    await new Promise<void>((resolve, reject) => {
      portToClose.close((error) => {
        if (error) {
          reject(new Error(this.getFriendlySerialError(error)))
          return
        }

        resolve()
      })
    })
  }

  getConnectionState(): {
    connected: boolean
    path: string | null
  } {
    return {
      connected: Boolean(this.port?.isOpen),
      path: this.connectedPortPath
    }
  }

  getFriendlySerialError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error ?? '')

    if (message.includes('Access denied') || message.includes('Permission denied')) {
      return 'El puerto está siendo utilizado por otra aplicación. Cierra el monitor serial de Arduino IDE.'
    }

    if (message.includes('File not found') || message.includes('No such file')) {
      return 'El puerto seleccionado ya no está disponible.'
    }

    return message || 'No se pudo utilizar el puerto serial.'
  }
}

export const serialService = new SerialService()
