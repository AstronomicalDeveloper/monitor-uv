import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/common/Button'
import Select from '../components/common/Select'
import StatusMessage from '../components/common/StatusMessage'
import { useApp } from '../context/AppContext'
import type { SerialPortInfo } from '../types/serial'

function ConnectionPage() {
  const navigate = useNavigate()
  const { registerConnection } = useApp()

  const [selectedPort, setSelectedPort] =
    useState<string>('')

  const [testedPort, setTestedPort] =
    useState<string>('')

  const [availablePorts, setAvailablePorts] =
    useState<SerialPortInfo[]>([])

  const [connectionStatus, setConnectionStatus] =
    useState<'idle' | 'testing' | 'success' | 'error'>(
      'idle'
    )

  const [isLoadingPorts, setIsLoadingPorts] =
    useState<boolean>(false)

  const [isConnecting, setIsConnecting] =
    useState<boolean>(false)

  const [portError, setPortError] =
    useState<string>('')

  const [receivedLine, setReceivedLine] =
    useState<string>('')

  const baudRate = 9600

  const statusContent = {
    idle: {
      title: 'Esperando conexión',
      description:
        'Actualiza la lista y selecciona el puerto donde está conectado el prototipo.'
    },
    testing: {
      title: 'Probando comunicación',
      description:
        'La aplicación está esperando una respuesta real del prototipo.'
    },
    success: {
      title: 'Conexión verificada',
      description:
        'El prototipo está enviando información correctamente.'
    },
    error: {
      title: 'No se pudo establecer la conexión',
      description:
        'Comprueba el cable USB, el puerto seleccionado y vuelve a intentarlo.'
    }
  }

  async function handleRefreshPorts() {
    setIsLoadingPorts(true)
    setPortError('')

    try {
      const result = await window.api.serial.listPorts()

      if (!result.success) {
        setAvailablePorts([])
        setSelectedPort('')
        setTestedPort('')
        setReceivedLine('')
        setConnectionStatus('error')
        setPortError(result.message || 'No se pudo completar la operación.')
        return
      }

      setAvailablePorts(result.data ?? [])

      const selectedPortStillExists = (result.data ?? []).some(
        (port) => port.path === selectedPort
      )

      if (!selectedPortStillExists) {
        setSelectedPort('')
        setTestedPort('')
        setReceivedLine('')
      }

      setConnectionStatus('idle')
    } catch (error) {
      console.error('Error al solicitar los puertos:', error)

      setAvailablePorts([])
      setSelectedPort('')
      setTestedPort('')
      setReceivedLine('')
      setConnectionStatus('error')
      setPortError(
        'No fue posible comunicarse con el proceso principal.'
      )
    } finally {
      setIsLoadingPorts(false)
    }
  }

  async function handleTestConnection() {
    if (!selectedPort) {
      return
    }

    setConnectionStatus('testing')
    setPortError('')
    setReceivedLine('')
    setTestedPort('')

    try {
      const result = await window.api.serial.testConnection({
        path: selectedPort,
        baudRate
      })

      if (!result.success) {
        setConnectionStatus('error')
        setPortError(result.message || 'No se pudo completar la operación.')
        return
      }

      setReceivedLine(result.data?.firstLine ?? '')
      setTestedPort(selectedPort)
      setConnectionStatus('success')
    } catch (error) {
      console.error(
        'Error durante la prueba serial:',
        error
      )

      setConnectionStatus('error')
      setPortError(
        'No fue posible ejecutar la prueba de conexión.'
      )
    }
  }

  async function handleConnect() {
    if (
      connectionStatus !== 'success' ||
      testedPort !== selectedPort
    ) {
      return
    }

    setIsConnecting(true)
    setPortError('')

    try {
      const result = await window.api.serial.connect({
        path: selectedPort,
        baudRate
      })

      if (!result.success) {
        setConnectionStatus('error')
        setPortError(result.message || 'No se pudo completar la operación.')
        return
      }

      registerConnection(result.data?.path ?? selectedPort)
      navigate('/monitoreo')
    } catch (error) {
      console.error(
        'Error al conectar el dispositivo:',
        error
      )

      setConnectionStatus('error')
      setPortError(
        'No fue posible mantener abierta la conexión.'
      )
    } finally {
      setIsConnecting(false)
    }
  }

  useEffect(() => {
    handleRefreshPorts()
  }, [])

  const currentStatus = statusContent[connectionStatus]

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-emerald-50 via-slate-50 to-violet-100 text-slate-800">
      <div className="pointer-events-none absolute -left-24 top-12 h-96 w-96 rounded-full bg-emerald-200/55 blur-3xl" />

      <div className="pointer-events-none absolute -right-24 bottom-8 h-120 w-[30rem] rounded-full bg-violet-200/60 blur-3xl" />

      <div className="pointer-events-none absolute left-1/3 top-1/3 h-72 w-72 rounded-full bg-blue-100/50 blur-3xl" />

      <main className="relative z-10 grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
        <section className="hidden flex-col justify-between p-12 lg:flex">
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-300 to-violet-400 text-lg font-bold text-white shadow-lg">
              UV
            </div>

            <p className="mt-5 font-semibold text-slate-700">
              Monitor Ambiental UV
            </p>
          </div>

          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
              Prototipo de monitoreo
            </p>

            <h1 className="mt-5 text-5xl font-bold leading-tight text-slate-800">
              Conecta el dispositivo y comienza a observar el ambiente.
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
              La aplicación recibirá directamente las mediciones de
              radiación ultravioleta y las variables ambientales enviadas
              por el prototipo.
            </p>
          </div>

          <p className="text-sm text-slate-500">
            Proyecto académico de Arquitectura de Computadoras
          </p>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
          <div className="w-full max-w-lg rounded-[2.25rem] border border-white/75 bg-white/50 p-7 shadow-2xl shadow-violet-200/35 backdrop-blur-2xl sm:p-9">
            <div className="lg:hidden">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-300 to-violet-400 text-lg font-bold text-white shadow-lg">
                UV
              </div>
            </div>

            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-violet-700 lg:mt-0">
              Configuración serial
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Conexión del dispositivo
            </h2>

            <p className="mt-3 leading-7 text-slate-600">
              Selecciona el puerto donde se encuentra conectado el
              prototipo y verifica la comunicación antes de continuar.
            </p>

            <div className="mt-8 space-y-5">
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <Select
                  id="serial-port"
                  label="Puerto serial"
                  value={selectedPort}
                  onChange={(event) => {
                    setSelectedPort(event.target.value)
                    setTestedPort('')
                    setReceivedLine('')
                    setConnectionStatus('idle')
                    setPortError('')
                  }}
                  disabled={isLoadingPorts || isConnecting}
                >
                  <option value="">
                    {availablePorts.length === 0
                      ? 'No se encontraron puertos'
                      : 'Selecciona un puerto'}
                  </option>

                  {availablePorts.map((port) => (
                    <option
                      key={port.path}
                      value={port.path}
                    >
                      {port.manufacturer
                        ? `${port.path} — ${port.manufacturer}`
                        : port.path}
                    </option>
                  ))}
                </Select>

                <Button
                  variant="secondary"
                  onClick={handleRefreshPorts}
                  disabled={isLoadingPorts || isConnecting}
                  className="h-[50px] px-4"
                >
                  {isLoadingPorts
                    ? 'Buscando...'
                    : 'Actualizar'}
                </Button>
              </div>

              <StatusMessage
                status={
                  isLoadingPorts
                    ? 'testing'
                    : connectionStatus
                }
                title={
                  isLoadingPorts
                    ? 'Buscando puertos seriales'
                    : currentStatus.title
                }
                description={
                  portError ||
                  (isLoadingPorts
                    ? 'Consultando los dispositivos conectados al equipo.'
                    : currentStatus.description)
                }
              />

              {receivedLine && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Primera respuesta recibida
                  </p>

                  <code className="mt-2 block break-words text-sm text-slate-700">
                    {receivedLine}
                  </code>
                </div>
              )}

              <Button
                variant="secondary"
                disabled={
                  !selectedPort ||
                  connectionStatus === 'testing' ||
                  isConnecting ||
                  isLoadingPorts
                }
                onClick={handleTestConnection}
                className="w-full"
              >
                {connectionStatus === 'testing'
                  ? 'Esperando datos...'
                  : 'Probar conexión'}
              </Button>

              <Button
                disabled={
                  connectionStatus !== 'success' ||
                  testedPort !== selectedPort ||
                  isConnecting
                }
                onClick={handleConnect}
                className="w-full"
              >
                {isConnecting
                  ? 'Conectando...'
                  : 'Conectar y continuar'}
              </Button>
            </div>

            <p className="mt-6 text-center text-xs leading-5 text-slate-500">
              La aplicación comprobará que el prototipo envíe datos antes
              de establecer la conexión permanente.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default ConnectionPage
