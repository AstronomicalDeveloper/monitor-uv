import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/common/Button'
import GlassPanel from '../components/glass/GlassPanel'
import type { SessionSummary } from '../types/database'

function formatDate(value: string | null): string {
  if (!value) {
    return '--'
  }

  return new Date(value).toLocaleString()
}

function formatNumber(value: number | null, decimals = 2): string {
  if (value === null || Number.isNaN(value)) {
    return '--'
  }

  return value.toFixed(decimals)
}

function HistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadSessions(): Promise<void> {
    setLoading(true)
    setError('')

    try {
      const result = await window.api.database.listSessions()

      if (!result.success || !result.data) {
        setError(
          result.message ||
            'No se pudo cargar el historial.'
        )
        setSessions([])
        return
      }

      setSessions(result.data)
    } catch (loadError) {
      console.error('Error al cargar historial:', loadError)
      setError('No fue posible consultar MariaDB.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Sesiones almacenadas
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-800">
            Historial
          </h1>

          <p className="mt-2 text-slate-500">
            Consulta las sesiones guardadas en MariaDB.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={loadSessions}
          disabled={loading}
        >
          {loading ? 'Cargando...' : 'Actualizar'}
        </Button>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-rose-700">
          {error}
        </div>
      )}

      <GlassPanel>
        {sessions.length === 0 && !loading ? (
          <div className="p-10 text-center">
            <h2 className="text-xl font-semibold text-slate-800">
              No hay sesiones registradas
            </h2>

            <p className="mt-2 text-slate-500">
              Las sesiones finalizadas aparecerán en esta pantalla.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/70 text-slate-500">
                  <th className="px-4 py-3">Sesión</th>
                  <th className="px-4 py-3">Inicio</th>
                  <th className="px-4 py-3">Modo</th>
                  <th className="px-4 py-3">Muestras</th>
                  <th className="px-4 py-3">UV máx.</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acción</th>
                </tr>
              </thead>

              <tbody>
                {sessions.map((session) => (
                  <tr
                    key={session.sessionId}
                    className="border-b border-white/50 text-slate-700"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">
                        {session.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {session.location || 'Sin lugar'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(session.startedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {session.mode === 'timed'
                        ? 'Temporizada'
                        : 'Manual'}
                    </td>
                    <td className="px-4 py-3">
                      {session.totalSamples}
                    </td>
                    <td className="px-4 py-3">
                      {formatNumber(session.uvMax, 3)} V
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-semibold text-slate-600">
                        {session.status === 'finished'
                          ? 'Finalizada'
                          : session.status === 'active'
                            ? 'Activa'
                            : 'Cancelada'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/historial/${session.sessionId}`}
                        className="font-semibold text-violet-700 hover:text-violet-900"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </section>
  )
}

export default HistoryPage
