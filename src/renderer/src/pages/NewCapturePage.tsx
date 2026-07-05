import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/common/Button'
import Select from '../components/common/Select'
import GlassCard from '../components/glass/GlassCard'
import GlassPanel from '../components/glass/GlassPanel'
import { useApp } from '../context/AppContext'
import type { CaptureMode } from '../types/database'

function NewCapturePage() {
  const navigate = useNavigate()

  const {
    connected,
    connectedPort,
    capturing,
    databaseError,
    startCapture
  } = useApp()

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<CaptureMode>('manual')
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(10)
  const [seconds, setSeconds] = useState(0)
  const [storageIntervalSeconds, setStorageIntervalSeconds] = useState(1)
  const [formError, setFormError] = useState('')
  const [starting, setStarting] = useState(false)

  const durationSeconds = useMemo(() => {
    return hours * 3600 + minutes * 60 + seconds
  }, [hours, minutes, seconds])

  function applyQuickDuration(totalMinutes: number): void {
    setHours(Math.floor(totalMinutes / 60))
    setMinutes(totalMinutes % 60)
    setSeconds(0)
    setMode('timed')
  }

  async function handleStartCapture(): Promise<void> {
    setFormError('')

    if (!connected) {
      setFormError('Primero debes conectar el prototipo.')
      return
    }

    if (capturing) {
      setFormError('Ya existe una captura activa.')
      return
    }

    if (!name.trim()) {
      setFormError('Ingresa un nombre para la sesión.')
      return
    }

    if (mode === 'timed' && durationSeconds <= 0) {
      setFormError('La duración programada debe ser mayor a cero.')
      return
    }

    setStarting(true)

    const created = await startCapture({
      name: name.trim(),
      location: location.trim(),
      description: description.trim(),
      mode,
      durationSeconds: mode === 'timed' ? durationSeconds : null,
      storageIntervalSeconds
    })

    setStarting(false)

    if (created) {
      navigate('/monitoreo')
    }
  }

  if (!connected) {
    return (
      <section className="space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700">
            Sesiones
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-800">
            Nueva captura
          </h1>
        </header>

        <GlassPanel>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-slate-800">
              No se puede iniciar una captura
            </h2>

            <p className="mt-2 text-slate-500">
              Primero debes conectar el prototipo mediante el puerto serial.
            </p>

            <Button
              onClick={() => navigate('/conexion')}
              className="mt-6"
            >
              Ir a conexión
            </Button>
          </div>
        </GlassPanel>
      </section>
    )
  }

  if (capturing) {
    return (
      <section className="space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700">
            Sesiones
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-800">
            Nueva captura
          </h1>
        </header>

        <GlassPanel>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-slate-800">
              Ya existe una captura activa
            </h2>

            <p className="mt-2 text-slate-500">
              Finaliza la sesión actual antes de crear una nueva.
            </p>

            <Button
              onClick={() => navigate('/monitoreo')}
              className="mt-6"
            >
              Ir al monitoreo
            </Button>
          </div>
        </GlassPanel>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700">
            Sesiones
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-800">
            Nueva captura
          </h1>

          <p className="mt-2 text-slate-500">
            Configura la sesión que guardará las mediciones reales del prototipo.
          </p>
        </div>

        <GlassCard padding="px-5 py-4" solid>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Puerto conectado
          </p>

          <p className="mt-1 font-bold text-emerald-700">
            {connectedPort}
          </p>
        </GlassCard>
      </header>

      {(formError || databaseError) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-rose-700">
          <p className="font-semibold">No se pudo iniciar</p>
          <p className="mt-1 text-sm">{formError || databaseError}</p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <GlassPanel
          title="Datos de la sesión"
          description="Estos datos aparecerán luego en el historial y los reportes."
        >
          <div className="grid gap-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Nombre de la sesión
              </label>

              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Medición patio central"
                className="w-full rounded-2xl border border-white/80 bg-white/60 px-4 py-3 text-slate-700 outline-none backdrop-blur-xl transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Lugar
              </label>

              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Ej. Facultad, laboratorio, patio"
                className="w-full rounded-2xl border border-white/80 bg-white/60 px-4 py-3 text-slate-700 outline-none backdrop-blur-xl transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Observaciones
              </label>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Condiciones del entorno, ubicación del prototipo, etc."
                className="w-full resize-none rounded-2xl border border-white/80 bg-white/60 px-4 py-3 text-slate-700 outline-none backdrop-blur-xl transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />
            </div>
          </div>
        </GlassPanel>

        <GlassPanel
          title="Configuración de captura"
          description="Define cómo terminará la sesión y cada cuánto se guardarán mediciones."
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={[
                  'rounded-2xl border px-4 py-4 text-left transition',
                  mode === 'manual'
                    ? 'border-emerald-300 bg-emerald-50/80 text-emerald-800'
                    : 'border-white/70 bg-white/45 text-slate-600 hover:bg-white/70'
                ].join(' ')}
              >
                <span className="font-bold">Manual</span>
                <span className="mt-1 block text-sm">Termina cuando pulses finalizar.</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('timed')}
                className={[
                  'rounded-2xl border px-4 py-4 text-left transition',
                  mode === 'timed'
                    ? 'border-violet-300 bg-violet-50/80 text-violet-800'
                    : 'border-white/70 bg-white/45 text-slate-600 hover:bg-white/70'
                ].join(' ')}
              >
                <span className="font-bold">Temporizada</span>
                <span className="mt-1 block text-sm">Termina automáticamente.</span>
              </button>
            </div>

            {mode === 'timed' && (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  Duración
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="number"
                    min="0"
                    value={hours}
                    onChange={(event) => setHours(Number(event.target.value))}
                    className="rounded-2xl border border-white/80 bg-white/60 px-4 py-3 text-slate-700 outline-none"
                    aria-label="Horas"
                  />

                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={(event) => setMinutes(Number(event.target.value))}
                    className="rounded-2xl border border-white/80 bg-white/60 px-4 py-3 text-slate-700 outline-none"
                    aria-label="Minutos"
                  />

                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={seconds}
                    onChange={(event) => setSeconds(Number(event.target.value))}
                    className="rounded-2xl border border-white/80 bg-white/60 px-4 py-3 text-slate-700 outline-none"
                    aria-label="Segundos"
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[5, 10, 15, 30].map((quickMinutes) => (
                    <button
                      key={quickMinutes}
                      type="button"
                      onClick={() => applyQuickDuration(quickMinutes)}
                      className="rounded-full bg-white/55 px-3 py-1 text-sm font-semibold text-violet-700 transition hover:bg-white/80"
                    >
                      {quickMinutes} min
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Select
              id="storage-interval"
              label="Frecuencia de almacenamiento"
              value={storageIntervalSeconds.toString()}
              onChange={(event) => setStorageIntervalSeconds(Number(event.target.value))}
            >
              <option value="1">Cada segundo</option>
              <option value="2">Cada 2 segundos</option>
              <option value="5">Cada 5 segundos</option>
              <option value="10">Cada 10 segundos</option>
            </Select>
          </div>
        </GlassPanel>
      </div>

      <GlassPanel
        title="Resumen previo"
        description="La sesión se creará en MariaDB al iniciar la captura."
        action={
          <Button
            onClick={handleStartCapture}
            disabled={starting}
          >
            {starting ? 'Iniciando...' : 'Iniciar captura'}
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <GlassCard padding="p-4" solid>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nombre</p>
            <p className="mt-2 font-bold text-slate-800">{name || 'Sin nombre'}</p>
          </GlassCard>

          <GlassCard padding="p-4" solid>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Modalidad</p>
            <p className="mt-2 font-bold text-slate-800">{mode === 'timed' ? 'Temporizada' : 'Manual'}</p>
          </GlassCard>

          <GlassCard padding="p-4" solid>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Duración</p>
            <p className="mt-2 font-bold text-slate-800">{mode === 'timed' ? `${durationSeconds} s` : 'Hasta finalizar'}</p>
          </GlassCard>

          <GlassCard padding="p-4" solid>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Almacenamiento</p>
            <p className="mt-2 font-bold text-slate-800">Cada {storageIntervalSeconds} s</p>
          </GlassCard>
        </div>
      </GlassPanel>
    </section>
  )
}

export default NewCapturePage
