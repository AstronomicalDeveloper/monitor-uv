export interface SerialPortInfo {
  path: string
  manufacturer: string | null
  serialNumber: string | null
  vendorId: string | null
  productId: string | null
  pnpId: string | null
}

export type AlertLevel = 'BAJO' | 'MEDIO' | 'ALTO'

export interface Measurement {
  uvAdc: number | null
  uvVoltage: number | null
  level: AlertLevel | null
  luminosity: number | null
  temperature: number | null
  humidity: number | null
  pressure: number | null
  presence: boolean | null
  dateTime: string | null
  receivedAt: string | null
}

export interface SerialConnectionState {
  connected: boolean
  path: string | null
}

export interface SerialConfiguration {
  path: string
  baudRate: number
}

export interface SerialResult<T = undefined> {
  success: boolean
  data?: T
  message?: string
}
