import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Measurement } from '../types/serial'
import type { CaptureSession, CaptureSessionInput } from '../types/database'

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

export function AppProvider({ children }: AppProviderProps): React.JSX.Element {
  const [connected, setConnected] = useState<boolean>(false)
  const [connectedPort, setConnectedPort] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState<string>('')
  const [databaseError, setDatabaseError] = useState<string>('')

  const [measurement, setMeasurement] = useState<Measurement>(initialMeasurement)
  const [measurementHistory, setMeasurementHistory] = useState<Measurement[]>([])

  const [activeSession, setActiveSession] = useState<CaptureSession | null>(null)

  const [receivedMeasurements, setReceivedMeasurements] = useState<number>(0)
  const [savedMeasurements, setSavedMeasurements] = useState<number>(0)

  const [capturing, setCapturing] = useState<boolean>(false)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const remainingSeconds =
    capturing && activeSession?.mode === 'timed' && activeSession.durationSeconds !== null
      ? Math.max(activeSession.durationSeconds - elapsedSeconds, 0)
      : null

  const capturingRef = useRef<boolean>(false)
  const activeSessionRef = useRef<CaptureSession | null>(null)
  const lastSavedAtRef = useRef<number>(0)

  const pendingSaveRef = useRef<Promise<void> | null>(null)
  const stoppingRef = useRef<Promise<void> | null>(null)
  const startingRef = useRef(false)
  const connectedRef = useRef(false)

  useEffect(() => {
    async function loadConnectionState(): Promise<void> {
      try {
        const result = await window.api.serial.getState()

        if (!result.success || !result.data) {
          setConnectionError(result.message || 'No se pudo consultar el estado del dispositivo.')
          return
        }

        connectedRef.current = result.data.connected
        setConnected(result.data.connected)
        setConnectedPort(result.data.path)
      } catch (error) {
        console.error('No se pudo consultar la conexión serial:', error)

        setConnectionError('No fue posible comunicarse con el proceso principal.')
      }
    }

    loadConnectionState()

    const removeMeasurementListener = window.api.serial.onMeasurement((newMeasurement) => {
      setMeasurement(newMeasurement)
      setMeasurementHistory((currentHistory) => [...currentHistory.slice(-199), newMeasurement])

      connectedRef.current = true
      setConnected(true)
      setConnectionError('')

      if (capturingRef.current) {
        setReceivedMeasurements((currentValue) => currentValue + 1)

        saveMeasurementIfNeeded(newMeasurement)
      }
    })

    const removeDisconnectedListener = window.api.serial.onDisconnected(() => {
      connectedRef.current = false
      setConnected(false)
      setConnectedPort(null)
      void stopCapture()

      setConnectionError('El dispositivo fue desconectado.')
    })

    const removeConnectionErrorListener = window.api.serial.onConnectionError((data) => {
      setConnectionError(data.message || 'Ocurrió un error en la conexión serial.')
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
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000)
      )
      setElapsedSeconds(elapsed)
      if (
        activeSession.mode === 'timed' &&
        activeSession.durationSeconds !== null &&
        elapsed >= activeSession.durationSeconds
      ) {
        void stopCapture()
      }
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [capturing, activeSession])

  async function saveMeasurementIfNeeded(newMeasurement: Measurement): Promise<void> {
    const session = activeSessionRef.current

    if (!capturingRef.current || pendingSaveRef.current || !session?.databaseId) {
      return
    }

    const now = Date.now()
    const intervalMs = session.storageIntervalSeconds * 1000

    if (lastSavedAtRef.current !== 0 && now - lastSavedAtRef.current < intervalMs) {
      return
    }

    const pending = persistMeasurement()
    pendingSaveRef.current = pending
    try {
      await pending
    } finally {
      pendingSaveRef.current = null
    }

    async function persistMeasurement(): Promise<void> {
      try {
        const result = await window.api.database.saveMeasurement({
          sessionId: session!.databaseId!,
          measurement: newMeasurement
        })

        if (!result.success) {
          setDatabaseError(result.message || 'No se pudo guardar la medición.')
          return
        }

        lastSavedAtRef.current = now
        setSavedMeasurements((currentValue) => currentValue + 1)
        setDatabaseError('')
      } catch (error) {
        console.error('Error al guardar medición:', error)
        setDatabaseError('No fue posible guardar la medición en MariaDB.')
      }
    }
  }

  function registerConnection(path: string): void {
    connectedRef.current = true
    setConnected(true)
    setConnectedPort(path)
    setConnectionError('')
  }

  async function disconnectDevice(): Promise<boolean> {
    try {
      await stopCapture()
      if (activeSessionRef.current?.status === 'active') return false
      const result = await window.api.serial.disconnect()

      if (!result.success) {
        setConnectionError(result.message || 'No se pudo desconectar el dispositivo.')

        return false
      }

      connectedRef.current = false
      setConnected(false)
      setConnectedPort(null)
      setCapturing(false)
      activeSessionRef.current = null
      setActiveSession(null)
      setMeasurement(initialMeasurement)
      setMeasurementHistory([])
      setReceivedMeasurements(0)
      setSavedMeasurements(0)
      setElapsedSeconds(0)

      setConnectionError('')

      return true
    } catch (error) {
      console.error('Error al desconectar el dispositivo:', error)

      setConnectionError('No fue posible desconectar el dispositivo.')

      return false
    }
  }

  async function startCapture(session: CaptureSessionInput): Promise<boolean> {
    if (
      startingRef.current ||
      stoppingRef.current ||
      activeSessionRef.current?.status === 'active' ||
      !connectedRef.current
    ) {
      setDatabaseError('Finaliza la sesion pendiente y conecta el prototipo antes de iniciar.')
      return false
    }
    startingRef.current = true
    const startedAt = new Date().toISOString()

    try {
      const result = await window.api.database.createSession({
        ...session,
        startedAt
      })

      if (!result.success || !result.data) {
        setDatabaseError(result.message || 'No se pudo crear la sesión en MariaDB.')
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

      activeSessionRef.current = newSession
      setActiveSession(newSession)
      if (!connectedRef.current) {
        await stopCapture()
        return false
      }
      capturingRef.current = true
      setCapturing(true)
      setReceivedMeasurements(0)
      setSavedMeasurements(0)
      setElapsedSeconds(0)

      lastSavedAtRef.current = 0
      setDatabaseError('')

      return true
    } catch (error) {
      console.error('Error al iniciar captura:', error)
      setDatabaseError('No fue posible crear la sesión en MariaDB.')
      return false
    } finally {
      startingRef.current = false
    }
  }

  function stopCapture(): Promise<void> {
    if (stoppingRef.current) return stoppingRef.current
    capturingRef.current = false
    setCapturing(false)

    const currentSession = activeSessionRef.current
    if (!currentSession?.databaseId || currentSession.status !== 'active') return Promise.resolve()

    const pending = (async () => {
      await pendingSaveRef.current
      const finishedAt = new Date().toISOString()
      try {
        const result = await window.api.database.finishSession({
          sessionId: currentSession.databaseId!,
          finishedAt
        })
        if (!result.success) {
          setDatabaseError(result.message || 'No se pudo finalizar la sesion. Vuelve a intentarlo.')
          return
        }
        const finished: CaptureSession = { ...currentSession, finishedAt, status: 'finished' }
        activeSessionRef.current = finished
        setActiveSession(finished)
      } catch {
        setDatabaseError('No se pudo finalizar la sesion en MariaDB. Vuelve a intentarlo.')
      }
    })()
    stoppingRef.current = pending
    void pending.finally(() => {
      stoppingRef.current = null
    })
    return pending
  }

  function clearSession(): void {
    if (startingRef.current || stoppingRef.current || activeSessionRef.current?.status === 'active')
      return
    activeSessionRef.current = null
    capturingRef.current = false
    setActiveSession(null)
    setCapturing(false)
    setElapsedSeconds(0)

    setReceivedMeasurements(0)
    setSavedMeasurements(0)
    lastSavedAtRef.current = 0
  }

  const value = {
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
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// The hook intentionally shares its provider module.
// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const context = useContext(AppContext)

  if (!context) {
    throw new Error('useApp debe utilizarse dentro de AppProvider.')
  }

  return context
}
