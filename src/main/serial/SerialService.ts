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

class SerialService extends EventEmitter {
  private port: SerialPort | null = null
  private parser: ReadlineParser | null = null
  private connectedPortPath: string | null = null
  private currentMeasurement: PartialMeasurement = {}

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

      throw new Error(
        'No se pudieron obtener los puertos seriales disponibles.'
      )
    }
  }

  async testConnection(
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
          reject(
            new Error(
              'El puerto se abrió, pero no se recibieron datos del prototipo.'
            )
          )
        })
      }, 8000)

      parser.once('data', (data: Buffer | string) => {
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
          reject(
            new Error(this.getFriendlySerialError(error))
          )
        })
      })

      testPort.open((error) => {
        if (error) {
          finish(() => {
            reject(
              new Error(this.getFriendlySerialError(error))
            )
          })
        }
      })
    })
  }

  async connect(
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

      await this.disconnect()
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

      port.open((error) => {
        if (error) {
          reject(
            new Error(this.getFriendlySerialError(error))
          )
          return
        }

        this.port = port
        this.parser = parser
        this.connectedPortPath = path
        this.currentMeasurement = {}

        parser.on('data', (data: Buffer | string) => {
          const line = data.toString().trim()

          if (line) {
            this.processLine(line)
          }
        })

        port.on('error', (serialError) => {
          console.error(
            'Error durante la conexión serial:',
            serialError
          )

          this.emit('connection-error', {
            message: this.getFriendlySerialError(serialError)
          })
        })

        port.on('close', () => {
          const disconnectedPath = this.connectedPortPath

          this.port = null
          this.parser = null
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
    this.emit('raw-line', line)

    const uvMatch = line.match(
      /UV\s*ADC:\s*(-?\d+)\s*\|\s*Voltaje:\s*(-?[\d.]+)\s*V/i
    )

    if (uvMatch) {
      this.currentMeasurement.uvAdc = Number(uvMatch[1])
      this.currentMeasurement.uvVoltage = Number(uvMatch[2])
      return
    }

    const levelMatch = line.match(
      /Nivel:\s*(BAJO|MEDIO|ALTO)/i
    )

    if (levelMatch) {
      this.currentMeasurement.level =
        levelMatch[1].toUpperCase() as 'BAJO' | 'MEDIO' | 'ALTO'

      return
    }

    const luminosityMatch = line.match(
      /Luz:\s*(-?[\d.]+)\s*lux/i
    )

    if (luminosityMatch) {
      this.currentMeasurement.luminosity = Number(
        luminosityMatch[1]
      )
      return
    }

    const temperatureMatch = line.match(
      /Temperatura:\s*(-?[\d.]+)\s*(?:°?\s*C)?/i
    )

    if (temperatureMatch) {
      this.currentMeasurement.temperature = Number(
        temperatureMatch[1]
      )
      return
    }

    const humidityMatch = line.match(
      /Humedad:\s*(-?[\d.]+)\s*%/i
    )

    if (humidityMatch) {
      this.currentMeasurement.humidity = Number(
        humidityMatch[1]
      )
      return
    }

    const pressureMatch = line.match(
      /Presi[oó]n:\s*(-?[\d.]+)\s*hPa/i
    )

    if (pressureMatch) {
      this.currentMeasurement.pressure = Number(
        pressureMatch[1]
      )
      return
    }

    const presenceMatch = line.match(
      /Presencia:\s*(DETECTADA|NO\s+DETECTADA)/i
    )

    if (presenceMatch) {
      this.currentMeasurement.presence =
        presenceMatch[1]
          .replace(/\s+/g, ' ')
          .toUpperCase() === 'DETECTADA'

      return
    }

    const dateTimeMatch = line.match(
      /Fecha\s+y\s+hora:\s*(.+)$/i
    )

    if (dateTimeMatch) {
      this.currentMeasurement.dateTime =
        dateTimeMatch[1].trim()

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

      this.emit('measurement', measurement)
      this.currentMeasurement = {}
    }
  }

  async disconnect(): Promise<void> {
    this.parser?.removeAllListeners()

    if (!this.port?.isOpen) {
      this.port = null
      this.parser = null
      this.connectedPortPath = null
      this.currentMeasurement = {}
      return
    }

    const portToClose = this.port

    await new Promise<void>((resolve, reject) => {
      portToClose.close((error) => {
        if (error) {
          reject(
            new Error(this.getFriendlySerialError(error))
          )
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
    const message =
      error instanceof Error ? error.message : String(error ?? '')

    if (
      message.includes('Access denied') ||
      message.includes('Permission denied')
    ) {
      return 'El puerto está siendo utilizado por otra aplicación. Cierra el monitor serial de Arduino IDE.'
    }

    if (
      message.includes('File not found') ||
      message.includes('No such file')
    ) {
      return 'El puerto seleccionado ya no está disponible.'
    }

    return message || 'No se pudo utilizar el puerto serial.'
  }
}

export const serialService = new SerialService()
