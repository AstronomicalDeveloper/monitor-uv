import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import SimpleLineChart from '../components/charts/SimpleLineChart'
import GlassCard from '../components/glass/GlassCard'
import GlassPanel from '../components/glass/GlassPanel'
import type { SessionDetail } from '../types/database'

function formatNumber(value: number | null, decimals = 2): string {
  if (value === null || Number.isNaN(value)) {
    return '--'
  }

  return value.toFixed(decimals)
}

function HistoryDetailPage() {
  const { sessionId } = useParams()
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadDetail(): Promise<void> {
      if (!sessionId) {
        setError('No se recibió el identificador de la sesión.')
        setLoading(false)
        return
      }

      try {
        const result = await window.api.database.getSessionDetail(Number(sessionId))

        if (!result.success || !result.data) {
          setError(result.message || 'No se pudo cargar el detalle.')
          return
        }

        setDetail(result.data)
      } catch (loadError) {
        console.error('Error al cargar detalle:', loadError)
        setError('No fue posible consultar MariaDB.')
      } finally {
        setLoading(false)
      }
    }

    loadDetail()
  }, [sessionId])

  if (loading) {
    return <p className="text-slate-500">Cargando detalle...</p>
  }

  if (error || !detail) {
    return (
      <section className="space-y-4">
        <p className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-rose-700">
          {error || 'No hay información disponible.'}
        </p>
        <Link to="/historial" className="font-semibold text-violet-700">
          Volver al historial
        </Link>
      </section>
    )
  }

  const { session, stats, measurements } = detail

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Historial
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-800">
          {session.name}
        </h1>

        <p className="mt-2 text-slate-500">
          {session.location || 'Sin lugar especificado'}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <GlassCard solid>
          <p className="text-sm text-slate-500">Muestras</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{stats.samples}</p>
        </GlassCard>
        <GlassCard solid>
          <p className="text-sm text-slate-500">UV máximo</p>
          <p className="mt-2 text-3xl font-bold text-violet-700">{formatNumber(stats.uvMax, 3)} V</p>
        </GlassCard>
        <GlassCard solid>
          <p className="text-sm text-slate-500">Temp. promedio</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{formatNumber(stats.temperatureAvg)} °C</p>
        </GlassCard>
        <GlassCard solid>
          <p className="text-sm text-slate-500">Presencia</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{stats.presenceCount}</p>
        </GlassCard>
      </div>

      <GlassPanel title="Evolución UV">
        <SimpleLineChart
          unit="V"
          points={measurements.map((item) => ({
            label: item.dateTime,
            value: item.uvVoltage
          }))}
        />
      </GlassPanel>

      <div className="grid gap-6 xl:grid-cols-2">
        <GlassPanel title="Temperatura">
          <SimpleLineChart
            unit="°C"
            points={measurements.map((item) => ({
              label: item.dateTime,
              value: item.temperature
            }))}
          />
        </GlassPanel>

        <GlassPanel title="Luminosidad">
          <SimpleLineChart
            unit="lux"
            points={measurements.map((item) => ({
              label: item.dateTime,
              value: item.luminosity
            }))}
          />
        </GlassPanel>
      </div>

      <GlassPanel title="Mediciones almacenadas">
        <div className="max-h-96 overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/70 text-slate-500">
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">UV</th>
                <th className="px-4 py-3">Nivel</th>
                <th className="px-4 py-3">Temp.</th>
                <th className="px-4 py-3">Humedad</th>
                <th className="px-4 py-3">Presencia</th>
              </tr>
            </thead>
            <tbody>
              {measurements.map((item) => (
                <tr key={item.measurementId} className="border-b border-white/50">
                  <td className="px-4 py-3">{item.dateTime || item.receivedAt || '--'}</td>
                  <td className="px-4 py-3">{formatNumber(item.uvVoltage, 3)} V</td>
                  <td className="px-4 py-3">{item.level || '--'}</td>
                  <td className="px-4 py-3">{formatNumber(item.temperature)} °C</td>
                  <td className="px-4 py-3">{formatNumber(item.humidity)} %</td>
                  <td className="px-4 py-3">{item.presence ? 'Detectada' : 'No detectada'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </section>
  )
}

export default HistoryDetailPage
