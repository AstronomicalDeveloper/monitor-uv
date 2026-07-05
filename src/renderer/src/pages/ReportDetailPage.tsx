import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/common/Button'
import SimpleLineChart from '../components/charts/SimpleLineChart'
import GlassCard from '../components/glass/GlassCard'
import GlassModal from '../components/glass/GlassModal'
import GlassPanel from '../components/glass/GlassPanel'
import type { ReportSummary } from '../types/database'

function formatNumber(value: number | null, decimals = 2): string {
  if (value === null || Number.isNaN(value)) {
    return '--'
  }

  return value.toFixed(decimals)
}

function ReportDetailPage() {
  const { reportId } = useParams()
  const [report, setReport] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportMessage, setExportMessage] = useState('')
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)
  const [showObservations, setShowObservations] = useState(false)

  const sessionIds = useMemo(
    () =>
      (reportId || '')
        .split(',')
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    [reportId]
  )

  useEffect(() => {
    async function loadReport(): Promise<void> {
      if (sessionIds.length === 0) {
        setError('Selecciona al menos una sesión para generar el reporte.')
        setLoading(false)
        return
      }

      try {
        const result = await window.api.database.getReport(sessionIds)

        if (!result.success || !result.data) {
          setError(result.message || 'No se pudo generar el reporte.')
          return
        }

        setReport(result.data)
      } catch (loadError) {
        console.error('Error al generar reporte:', loadError)
        setError('No fue posible consultar MariaDB.')
      } finally {
        setLoading(false)
      }
    }

    loadReport()
  }, [sessionIds])

  async function handleExport(type: 'csv' | 'pdf'): Promise<void> {
    if (sessionIds.length === 0) {
      return
    }

    setExportMessage('')
    setExporting(type)

    try {
      const result = type === 'csv'
        ? await window.api.database.exportReportCsv(sessionIds)
        : await window.api.database.exportReportPdf(sessionIds)

      if (!result.success || !result.data) {
        setExportMessage(
          result.message || 'No se pudo exportar el reporte.'
        )
        return
      }

      if (result.data.canceled) {
        setExportMessage('Exportación cancelada.')
        return
      }

      setExportMessage(
        type === 'csv'
          ? `CSV generado: ${result.data.filePath}`
          : `PDF generado: ${result.data.filePath}`
      )
    } catch (exportError) {
      console.error('Error al exportar reporte:', exportError)
      setExportMessage('No fue posible exportar el reporte.')
    } finally {
      setExporting(null)
    }
  }

  if (loading) {
    return <p className="text-slate-500">Generando reporte...</p>
  }

  if (error || !report) {
    return (
      <section className="space-y-4">
        <p className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-rose-700">
          {error || 'No hay información disponible.'}
        </p>
        <Link to="/reportes" className="font-semibold text-violet-700">
          Volver a reportes
        </Link>
      </section>
    )
  }

  const { sessions, stats, measurements } = report
  const sessionsWithObservations = sessions.filter(
    (session) => session.description?.trim()
  )

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700">
            Reportes
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-800">
            Reporte agrupado
          </h1>

          <p className="mt-2 text-slate-500">
            {sessions.length} sesión(es) incluidas en el análisis.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => setShowObservations(true)}
          >
            Ver observaciones
          </Button>

          <Button
            variant="secondary"
            disabled={exporting !== null}
            onClick={() => handleExport('csv')}
          >
            {exporting === 'csv' ? 'Generando CSV...' : 'Exportar CSV'}
          </Button>

          <Button
            disabled={exporting !== null}
            onClick={() => handleExport('pdf')}
          >
            {exporting === 'pdf' ? 'Generando PDF...' : 'Exportar PDF'}
          </Button>
        </div>
      </header>

      {exportMessage && (
        <p className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 text-sm text-violet-700">
          {exportMessage}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <GlassCard solid>
          <p className="text-sm text-slate-500">Muestras</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{stats.samples}</p>
        </GlassCard>
        <GlassCard solid>
          <p className="text-sm text-slate-500">UV máximo</p>
          <p className="mt-2 text-3xl font-bold text-violet-700">{formatNumber(stats.uvMax, 3)} V</p>
        </GlassCard>
        <GlassCard solid>
          <p className="text-sm text-slate-500">UV promedio</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{formatNumber(stats.uvAvg, 3)} V</p>
        </GlassCard>
        <GlassCard solid>
          <p className="text-sm text-slate-500">Temp. prom.</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{formatNumber(stats.temperatureAvg)} °C</p>
        </GlassCard>
        <GlassCard solid>
          <p className="text-sm text-slate-500">Luz prom.</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{formatNumber(stats.luminosityAvg)} lux</p>
        </GlassCard>
        <GlassCard solid>
          <p className="text-sm text-slate-500">Presencia</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{stats.presenceCount}</p>
        </GlassCard>
      </div>

      <GlassPanel title="Sesiones incluidas">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/70 text-slate-500">
                <th className="px-4 py-3">Sesión</th>
                <th className="px-4 py-3">Lugar</th>
                <th className="px-4 py-3">Muestras</th>
                <th className="px-4 py-3">UV máx.</th>
                <th className="px-4 py-3">Luz prom.</th>
                <th className="px-4 py-3">Observación</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.sessionId} className="border-b border-white/50">
                  <td className="px-4 py-3 font-semibold">{session.name}</td>
                  <td className="px-4 py-3">{session.location || '--'}</td>
                  <td className="px-4 py-3">{session.totalSamples}</td>
                  <td className="px-4 py-3">{formatNumber(session.uvMax, 3)} V</td>
                  <td className="px-4 py-3">{formatNumber(session.luminosityAvg)} lux</td>
                  <td className="max-w-[260px] truncate px-4 py-3">
                    {session.description || '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      <GlassPanel
        title="Índice UV agrupado"
        description="Tiempo vs voltaje del sensor UV para todas las sesiones seleccionadas."
      >
        <SimpleLineChart
          unit="V"
          xLabel="Tiempo"
          yLabel="Voltaje UV"
          points={measurements.map((item) => ({
            label: item.dateTime || item.receivedAt,
            value: item.uvVoltage
          }))}
        />
      </GlassPanel>

      <div className="grid gap-6 xl:grid-cols-2">
        <GlassPanel
          title="Temperatura"
          description="Tiempo vs temperatura ambiental."
        >
          <SimpleLineChart
            unit="°C"
            xLabel="Tiempo"
            yLabel="Temperatura"
            points={measurements.map((item) => ({
              label: item.dateTime || item.receivedAt,
              value: item.temperature
            }))}
          />
        </GlassPanel>

        <GlassPanel
          title="Humedad"
          description="Tiempo vs humedad relativa."
        >
          <SimpleLineChart
            unit="%"
            xLabel="Tiempo"
            yLabel="Humedad"
            points={measurements.map((item) => ({
              label: item.dateTime || item.receivedAt,
              value: item.humidity
            }))}
          />
        </GlassPanel>

        <GlassPanel
          title="Luminosidad"
          description="Tiempo vs nivel de iluminación registrado por el BH1750."
        >
          <SimpleLineChart
            unit="lux"
            xLabel="Tiempo"
            yLabel="Luminosidad"
            points={measurements.map((item) => ({
              label: item.dateTime || item.receivedAt,
              value: item.luminosity
            }))}
          />
        </GlassPanel>

        <GlassPanel
          title="Presión atmosférica"
          description="Tiempo vs presión atmosférica."
        >
          <SimpleLineChart
            unit="hPa"
            xLabel="Tiempo"
            yLabel="Presión"
            points={measurements.map((item) => ({
              label: item.dateTime || item.receivedAt,
              value: item.pressure
            }))}
          />
        </GlassPanel>
      </div>

      <GlassModal
        open={showObservations}
        title="Observaciones de las sesiones"
        description="Estas observaciones también se incluyen en el PDF exportado."
        onClose={() => setShowObservations(false)}
        footer={
          <Button onClick={() => setShowObservations(false)}>
            Cerrar
          </Button>
        }
      >
        {sessionsWithObservations.length === 0 ? (
          <p className="text-slate-500">
            No se registraron observaciones en las sesiones seleccionadas.
          </p>
        ) : (
          <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-2">
            {sessionsWithObservations.map((session) => (
              <article
                key={session.sessionId}
                className="rounded-2xl border border-white/70 bg-white/55 p-4"
              >
                <p className="font-semibold text-slate-800">
                  {session.name}
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {session.description}
                </p>
              </article>
            ))}
          </div>
        )}
      </GlassModal>
    </section>
  )
}

export default ReportDetailPage
