import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type { ReactNode } from 'react'
import type { Measurement } from '../types/serial'
import type {
  CaptureSession,
  CaptureSessionInput
} from '../types/database'

interface AppContextValue {
  connected: boolean
  connectedPort: string | null
  connectionError: string
  databaseError: string
  measurement: Measurement
  measurementHistory: Measurement[]
  receivedMeasurements: number
  savedMeasurements: number
  activeSession: CaptureSession | null
  capturing: boolean
  elapsedSeconds: number
  remainingSeconds: number | null
  registerConnection: (path: string) => void
  disconnectDevice: () => Promise<boolean>
  startCapture: (session: CaptureSessionInput) => Promise<boolean>
  stopCapture: () => Promise<void>
  clearSession: () => void
}

interface AppProviderProps {
  children: ReactNode
}

const AppContext = createContext<AppContextValue | null>(null)

const initialMeasurement: Measurement = {
  uvAdc: null,
  uvVoltage: null,
  level: null,
  luminosity: null,
  temperature: null,
  humidity: null,
  pressure: null,
  presence: null,
  dateTime: null,
  receivedAt: null
}

export function AppProvider({ children }: AppProviderProps) {
  const [connected, setConnected] = useState<boolean>(false)
  const [connectedPort, setConnectedPort] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState<string>('')
  const [databaseError, setDatabaseError] = useState<string>('')

  const [measurement, setMeasurement] =
    useState<Measurement>(initialMeasurement)
  const [measurementHistory, setMeasurementHistory] =
    useState<Measurement[]>([])

  const [activeSession, setActiveSession] =
    useState<CaptureSession | null>(null)

  const [receivedMeasurements, setReceivedMeasurements] =
    useState<number>(0)
  const [savedMeasurements, setSavedMeasurements] =
    useState<number>(0)

  const [capturing, setCapturing] = useState<boolean>(false)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const [remainingSeconds, setRemainingSeconds] =
    useState<number | null>(null)

  const capturingRef = useRef<boolean>(false)
  const activeSessionRef = useRef<CaptureSession | null>(null)
  const lastSavedAtRef = useRef<number>(0)

  useEffect(() => {
    capturingRef.current = capturing
  }, [capturing])

  useEffect(() => {
    activeSessionRef.current = activeSession
  }, [activeSession])

  useEffect(() => {
    async function loadConnectionState(): Promise<void> {
      try {
        const result = await window.api.serial.getState()

        if (!result.success || !result.data) {
          setConnectionError(
            result.message ||
              'No se pudo consultar el estado del dispositivo.'
          )
          return
        }

        setConnected(result.data.connected)
        setConnectedPort(result.data.path)
      } catch (error) {
        console.error(
          'No se pudo consultar la conexión serial:',
          error
        )

        setConnectionError(
          'No fue posible comunicarse con el proceso principal.'
        )
      }
    }

    loadConnectionState()

    const removeMeasurementListener =
      window.api.serial.onMeasurement((newMeasurement) => {
        setMeasurement(newMeasurement)
        setMeasurementHistory((currentHistory) => [
          ...currentHistory.slice(-199),
          newMeasurement
        ])

        setConnected(true)
        setConnectionError('')

        if (capturingRef.current) {
          setReceivedMeasurements(
            (currentValue) => currentValue + 1
          )

          saveMeasurementIfNeeded(newMeasurement)
        }
      })

    const removeDisconnectedListener =
      window.api.serial.onDisconnected(() => {
        setConnected(false)
        setConnectedPort(null)
        setCapturing(false)

        setConnectionError(
          'El dispositivo fue desconectado.'
        )
      })

    const removeConnectionErrorListener =
      window.api.serial.onConnectionError((data) => {
        setConnectionError(
          data.message ||
            'Ocurrió un error en la conexión serial.'
        )
      })

    return () => {
      removeMeasurementListener()
      removeDisconnectedListener()
      removeConnectionErrorListener()
    }
  }, [])

  useEffect(() => {
    if (!capturing || !activeSession) {
      return
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds((currentValue) => currentValue + 1)
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [capturing, activeSession])

  useEffect(() => {
    if (!capturing || !activeSession) {
      return
    }

    if (
      activeSession.mode === 'timed' &&
      activeSession.durationSeconds !== null
    ) {
      const remaining = Math.max(
        activeSession.durationSeconds - elapsedSeconds,
        0
      )

      setRemainingSeconds(remaining)

      if (remaining <= 0) {
        stopCapture()
      }
    }
  }, [elapsedSeconds, capturing, activeSession])

  async function saveMeasurementIfNeeded(
    newMeasurement: Measurement
  ): Promise<void> {
    const session = activeSessionRef.current

    if (!session?.databaseId) {
      return
    }

    const now = Date.now()
    const intervalMs = session.storageIntervalSeconds * 1000

    if (
      lastSavedAtRef.current !== 0 &&
      now - lastSavedAtRef.current < intervalMs
    ) {
      return
    }

    lastSavedAtRef.current = now

    try {
      const result = await window.api.database.saveMeasurement({
        sessionId: session.databaseId,
        measurement: newMeasurement
      })

      if (!result.success) {
        setDatabaseError(
          result.message ||
            'No se pudo guardar la medición.'
        )
        return
      }

      setSavedMeasurements((currentValue) => currentValue + 1)
      setDatabaseError('')
    } catch (error) {
      console.error('Error al guardar medición:', error)
      setDatabaseError(
        'No fue posible guardar la medición en MariaDB.'
      )
    }
  }

  function registerConnection(path: string): void {
    setConnected(true)
    setConnectedPort(path)
    setConnectionError('')
  }

  async function disconnectDevice(): Promise<boolean> {
    try {
      const result = await window.api.serial.disconnect()

      if (!result.success) {
        setConnectionError(
          result.message ||
            'No se pudo desconectar el dispositivo.'
        )

        return false
      }

      setConnected(false)
      setConnectedPort(null)
      setCapturing(false)
      setActiveSession(null)
      setMeasurement(initialMeasurement)
      setMeasurementHistory([])
      setReceivedMeasurements(0)
      setSavedMeasurements(0)
      setElapsedSeconds(0)
      setRemainingSeconds(null)
      setConnectionError('')

      return true
    } catch (error) {
      console.error(
        'Error al desconectar el dispositivo:',
        error
      )

      setConnectionError(
        'No fue posible desconectar el dispositivo.'
      )

      return false
    }
  }

  async function startCapture(
    session: CaptureSessionInput
  ): Promise<boolean> {
    const startedAt = new Date().toISOString()

    try {
      const result = await window.api.database.createSession({
        ...session,
        startedAt
      })

      if (!result.success || !result.data) {
        setDatabaseError(
          result.message ||
            'No se pudo crear la sesión en MariaDB.'
        )
        return false
      }

      const newSession: CaptureSession = {
        ...session,
        id: crypto.randomUUID(),
        databaseId: result.data.sessionId,
        startedAt,
        finishedAt: null,
        status: 'active'
      }

      setActiveSession(newSession)
      setCapturing(true)
      setReceivedMeasurements(0)
      setSavedMeasurements(0)
      setElapsedSeconds(0)
      setRemainingSeconds(session.durationSeconds)
      lastSavedAtRef.current = 0
      setDatabaseError('')

      return true
    } catch (error) {
      console.error('Error al iniciar captura:', error)
      setDatabaseError(
        'No fue posible crear la sesión en MariaDB.'
      )
      return false
    }
  }

  async function stopCapture(): Promise<void> {
    const currentSession = activeSessionRef.current
    const finishedAt = new Date().toISOString()

    setCapturing(false)
    setRemainingSeconds(null)

    setActiveSession((session) => {
      if (!session) {
        return null
      }

      return {
        ...session,
        finishedAt,
        status: 'finished'
      }
    })

    if (!currentSession?.databaseId) {
      return
    }

    try {
      const result = await window.api.database.finishSession({
        sessionId: currentSession.databaseId,
        finishedAt
      })

      if (!result.success) {
        setDatabaseError(
          result.message ||
            'La sesión finalizó localmente, pero no se actualizó en MariaDB.'
        )
        return
      }

      setDatabaseError('')
    } catch (error) {
      console.error('Error al finalizar sesión:', error)
      setDatabaseError(
        'La sesión finalizó localmente, pero no se pudo actualizar MariaDB.'
      )
    }
  }

  function clearSession(): void {
    setActiveSession(null)
    setCapturing(false)
    setElapsedSeconds(0)
    setRemainingSeconds(null)
    setReceivedMeasurements(0)
    setSavedMeasurements(0)
    lastSavedAtRef.current = 0
  }

  const value = useMemo(
    () => ({
      connected,
      connectedPort,
      connectionError,
      databaseError,
      measurement,
      measurementHistory,
      receivedMeasurements,
      savedMeasurements,
      activeSession,
      capturing,
      elapsedSeconds,
      remainingSeconds,
      registerConnection,
      disconnectDevice,
      startCapture,
      stopCapture,
      clearSession
    }),
    [
      connected,
      connectedPort,
      connectionError,
      databaseError,
      measurement,
      measurementHistory,
      receivedMeasurements,
      savedMeasurements,
      activeSession,
      capturing,
      elapsedSeconds,
      remainingSeconds
    ]
  )

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)

  if (!context) {
    throw new Error(
      'useApp debe utilizarse dentro de AppProvider.'
    )
  }

  return context
}
