import { useNavigate } from 'react-router-dom'
import Button from '../components/common/Button'
import SimpleLineChart from '../components/charts/SimpleLineChart'
import GlassCard from '../components/glass/GlassCard'
import GlassPanel from '../components/glass/GlassPanel'
import { useApp } from '../context/AppContext'

function MonitoringPage() {
  const navigate = useNavigate()

  const {
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
    stopCapture
  } = useApp()

  function formatValue(
    value: number | null | undefined,
    decimals = 2
  ): string {
    if (
      value === null ||
      value === undefined ||
      Number.isNaN(value)
    ) {
      return '--'
    }

    return Number(value).toFixed(decimals)
  }

  function formatTime(totalSeconds: number | null): string {
    if (totalSeconds === null) {
      return '--:--:--'
    }

    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return [hours, minutes, seconds]
      .map((value) => value.toString().padStart(2, '0'))
      .join(':')
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Monitoreo
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-800">
            Monitoreo en tiempo real
          </h1>

          <p className="mt-2 text-slate-500">
            {connected
              ? `Recibiendo datos desde ${connectedPort ?? 'el prototipo'}.`
              : 'No existe una conexión activa con el prototipo.'}
          </p>
        </div>

        {!connected && (
          <Button onClick={() => navigate('/conexion')}>
            Ir a conexión
          </Button>
        )}

        {connected && !capturing && (
          <Button onClick={() => navigate('/captura/nueva')}>
            Nueva captura
          </Button>
        )}
      </header>

      {(connectionError || databaseError) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-rose-700">
          <p className="font-semibold">
            Problema detectado
          </p>

          <p className="mt-1 text-sm">
            {connectionError || databaseError}
          </p>
        </div>
      )}

      {activeSession && (
        <GlassPanel>
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-violet-700">
                Sesión de captura
              </p>

              <p className="mt-2 text-xl font-bold text-slate-800">
                {activeSession.name}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {activeSession.location || 'Sin lugar especificado'}
              </p>

              {activeSession.description && (
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  {activeSession.description}
                </p>
              )}
            </div>

            <div className="grid gap-3 text-right sm:grid-cols-4">
              <div className="rounded-2xl bg-white/55 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Estado
                </p>

                <p className="mt-1 font-bold text-emerald-700">
                  {capturing ? 'Capturando' : 'Finalizada'}
                </p>
              </div>

              <div className="rounded-2xl bg-white/55 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Transcurrido
                </p>

                <p className="mt-1 font-mono text-lg font-bold text-slate-800">
                  {formatTime(elapsedSeconds)}
                </p>
              </div>

              <div className="rounded-2xl bg-white/55 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Restante
                </p>

                <p className="mt-1 font-mono text-lg font-bold text-slate-800">
                  {activeSession.mode === 'timed'
                    ? formatTime(remainingSeconds)
                    : 'Manual'}
                </p>
              </div>

              <div className="rounded-2xl bg-white/55 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Guardadas
                </p>

                <p className="mt-1 font-mono text-lg font-bold text-violet-700">
                  {savedMeasurements}
                </p>
              </div>
            </div>

            {capturing && (
              <Button
                variant="danger"
                onClick={() => {
                  stopCapture()
                }}
              >
                Finalizar captura
              </Button>
            )}
          </div>
        </GlassPanel>
      )}

      <GlassPanel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={[
                'h-3 w-3 rounded-full',
                connected
                  ? 'animate-pulse bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)]'
                  : 'bg-slate-400'
              ].join(' ')}
            />

            <div>
              <p className="font-semibold text-slate-800">
                {connected
                  ? 'Dispositivo conectado'
                  : 'Sin conexión'}
              </p>

              <p className="text-sm text-slate-500">
                {connectedPort ?? 'Puerto no disponible'}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-slate-500">
              Mediciones recibidas en sesión
            </p>

            <p className="text-2xl font-bold text-violet-700">
              {receivedMeasurements}
            </p>
          </div>
        </div>
      </GlassPanel>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <GlassCard className="md:col-span-2 xl:col-span-1">
          <p className="text-sm font-semibold uppercase tracking-wider text-violet-700">
            Sensor UV
          </p>

          <div className="mt-4 flex items-end gap-2">
            <p className="font-mono text-5xl font-bold text-slate-800">
              {formatValue(measurement.uvAdc, 0)}
            </p>

            <span className="mb-1 text-sm text-slate-500">
              ADC
            </span>
          </div>

          <div className="mt-5 border-t border-white/70 pt-4">
            <p className="text-sm text-slate-500">
              Voltaje
            </p>

            <p className="mt-1 text-xl font-bold text-slate-700">
              {formatValue(measurement.uvVoltage, 3)} V
            </p>
          </div>

          <div className="mt-4">
            <p className="text-sm text-slate-500">
              Nivel de alerta
            </p>

            <span
              className={[
                'mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold',
                measurement.level === 'BAJO'
                  ? 'bg-emerald-100 text-emerald-700'
                  : measurement.level === 'MEDIO'
                    ? 'bg-amber-100 text-amber-700'
                    : measurement.level === 'ALTO'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-100 text-slate-500'
              ].join(' ')}
            >
              {measurement.level ?? 'Sin datos'}
            </span>
          </div>
        </GlassCard>

        <GlassCard>
          <p className="text-sm font-semibold text-slate-500">
            Temperatura
          </p>

          <p className="mt-4 font-mono text-4xl font-bold text-slate-800">
            {formatValue(measurement.temperature)} °C
          </p>
        </GlassCard>

        <GlassCard>
          <p className="text-sm font-semibold text-slate-500">
            Humedad
          </p>

          <p className="mt-4 font-mono text-4xl font-bold text-slate-800">
            {formatValue(measurement.humidity)} %
          </p>
        </GlassCard>

        <GlassCard>
          <p className="text-sm font-semibold text-slate-500">
            Presión atmosférica
          </p>

          <p className="mt-4 font-mono text-4xl font-bold text-slate-800">
            {formatValue(measurement.pressure)} hPa
          </p>
        </GlassCard>

        <GlassCard>
          <p className="text-sm font-semibold text-slate-500">
            Luminosidad
          </p>

          <p className="mt-4 font-mono text-4xl font-bold text-slate-800">
            {formatValue(measurement.luminosity)} lux
          </p>
        </GlassCard>

        <GlassCard
          solid
          className={
            measurement.presence === true
              ? 'border-emerald-200 bg-emerald-50/80'
              : ''
          }
        >
          <p className="text-sm font-semibold text-slate-500">
            Presencia
          </p>

          <div className="mt-4 flex items-center gap-3">
            <span
              className={[
                'h-4 w-4 rounded-full',
                measurement.presence === true
                  ? 'animate-pulse bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.75)]'
                  : measurement.presence === false
                    ? 'bg-slate-400'
                    : 'bg-slate-300'
              ].join(' ')}
            />

            <p className="text-2xl font-bold text-slate-800">
              {measurement.presence === true
                ? 'Detectada'
                : measurement.presence === false
                  ? 'No detectada'
                  : '--'}
            </p>
          </div>
        </GlassCard>
      </section>

      <GlassPanel
        title="Gráfica UV en tiempo real"
        description="Muestra los últimos valores recibidos desde el prototipo."
      >
        <SimpleLineChart
          title="Voltaje UV"
          unit="V"
          points={measurementHistory.map((item) => ({
            label: item.dateTime,
            value: item.uvVoltage
          }))}
        />
      </GlassPanel>

      <div className="grid gap-6 xl:grid-cols-2">
        <GlassPanel title="Temperatura">
          <SimpleLineChart
            unit="°C"
            points={measurementHistory.map((item) => ({
              label: item.dateTime,
              value: item.temperature
            }))}
          />
        </GlassPanel>

        <GlassPanel title="Luminosidad">
          <SimpleLineChart
            unit="lux"
            points={measurementHistory.map((item) => ({
              label: item.dateTime,
              value: item.luminosity
            }))}
          />
        </GlassPanel>
      </div>
    </section>
  )
}

export default MonitoringPage
