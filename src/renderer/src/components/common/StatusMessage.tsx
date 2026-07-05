interface StatusMessageProps {
  status?: 'idle' | 'testing' | 'success' | 'error'
  title: string
  description?: string
}

const styles = {
  idle: {
    dot: 'bg-slate-400',
    container: 'border-slate-200 bg-white/45',
    text: 'text-slate-600'
  },
  testing: {
    dot: 'animate-pulse bg-amber-400',
    container: 'border-amber-200 bg-amber-50/60',
    text: 'text-amber-700'
  },
  success: {
    dot: 'bg-emerald-500',
    container: 'border-emerald-200 bg-emerald-50/60',
    text: 'text-emerald-700'
  },
  error: {
    dot: 'bg-rose-500',
    container: 'border-rose-200 bg-rose-50/60',
    text: 'text-rose-700'
  }
}

function StatusMessage({
  status = 'idle',
  title,
  description
}: StatusMessageProps) {
  const currentStyle = styles[status] ?? styles.idle

  return (
    <div
      className={`rounded-2xl border p-4 ${currentStyle.container}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${currentStyle.dot}`}
        />

        <div>
          <p className={`font-semibold ${currentStyle.text}`}>
            {title}
          </p>

          {description && (
            <p className="mt-1 text-sm text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default StatusMessage
