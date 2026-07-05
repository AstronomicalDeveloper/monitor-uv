import { Link } from 'react-router-dom'

interface ConnectionIndicatorProps {
  connected?: boolean
  portName?: string | null
}

function ConnectionIndicator({
  connected = false,
  portName = null
}: ConnectionIndicatorProps) {
  return (
    <Link
      to="/conexion"
      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/60 bg-white/45 px-4 py-2 text-sm shadow-sm backdrop-blur-xl transition hover:bg-white/65"
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          connected
            ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]'
            : 'bg-slate-400'
        }`}
      />

      <div className="flex flex-col">
        <span className="font-semibold text-slate-700">
          {connected ? 'Dispositivo conectado' : 'Sin conexión'}
        </span>

        {connected && portName && (
          <span className="text-xs text-slate-500">
            {portName}
          </span>
        )}
      </div>
    </Link>
  )
}

export default ConnectionIndicator
