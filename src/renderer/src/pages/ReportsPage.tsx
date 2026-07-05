import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/common/Button'
import GlassPanel from '../components/glass/GlassPanel'
import type { SessionSummary } from '../types/database'

function ReportsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [dateFilter, setDateFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadSessions(): Promise<void> {
    setLoading(true)
    setError('')

    try {
      const result = await window.api.database.listSessions()

      if (!result.success || !result.data) {
        setError(result.message || 'No se pudieron cargar las sesiones.')
        setSessions([])
        return
      }

      setSessions(result.data.filter((session) => session.totalSamples > 0))
    } catch (loadError) {
      console.error('Error al cargar sesiones para reporte:', loadError)
      setError('No fue posible consultar MariaDB.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  const filteredSessions = useMemo(() => {
    if (!dateFilter) {
      return sessions
    }

    return sessions.filter((session) =>
      session.startedAt?.startsWith(dateFilter)
    )
  }, [sessions, dateFilter])

  function toggleSession(sessionId: number): void {
    setSelectedIds((currentIds) =>
      currentIds.includes(sessionId)
        ? currentIds.filter((id) => id !== sessionId)
        : [...currentIds, sessionId]
    )
  }

  function selectFiltered(): void {
    setSelectedIds(filteredSessions.map((session) => session.sessionId))
  }

  const reportPath = selectedIds.length
    ? `/reportes/${selectedIds.join(',')}`
    : '/reportes'

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700">
            Análisis
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-800">
            Reportes
          </h1>

          <p className="mt-2 text-slate-500">
            Selecciona una o varias sesiones para analizar sus datos en conjunto.
          </p>
        </div>

        <Button variant="secondary" onClick={loadSessions} disabled={loading}>
          {loading ? 'Cargando...' : 'Actualizar'}
        </Button>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-rose-700">
          {error}
        </div>
      )}

      <GlassPanel
        title="Selección de sesiones"
        description="Puedes filtrar por fecha y seleccionar todas las sesiones de un mismo día."
        action={
          <Link
            to={reportPath}
            className={[
              'inline-flex cursor-pointer rounded-2xl px-5 py-3 font-semibold transition',
              selectedIds.length
                ? 'bg-gradient-to-r from-emerald-400 to-violet-500 text-white shadow-lg'
                : 'pointer-events-none bg-slate-200 text-slate-400'
            ].join(' ')}
          >
            Generar reporte
          </Link>
        }
      >
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Fecha
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="rounded-2xl border border-white/80 bg-white/60 px-4 py-3 text-slate-700 outline-none"
            />
          </div>

          <Button variant="secondary" onClick={selectFiltered}>
            Seleccionar visibles
          </Button>

          <Button
            variant="secondary"
            onClick={() => setSelectedIds([])}
          >
            Limpiar selección
          </Button>
        </div>

        {filteredSessions.length === 0 && !loading ? (
          <div className="p-10 text-center text-slate-500">
            No hay sesiones con datos disponibles para reportar.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredSessions.map((session) => {
              const selected = selectedIds.includes(session.sessionId)

              return (
                <button
                  type="button"
                  key={session.sessionId}
                  onClick={() => toggleSession(session.sessionId)}
                  className={[
                    'cursor-pointer rounded-3xl border p-5 text-left transition',
                    selected
                      ? 'border-violet-300 bg-violet-50/80 shadow-lg shadow-violet-200/30'
                      : 'border-white/70 bg-white/45 hover:bg-white/70'
                  ].join(' ')}
                >
                  <p className="font-bold text-slate-800">{session.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{session.location || 'Sin lugar'}</p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Muestras: {session.totalSamples}</span>
                    <span className="font-semibold text-violet-700">UV máx: {session.uvMax?.toFixed(3) ?? '--'} V</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </GlassPanel>
    </section>
  )
}

export default ReportsPage
