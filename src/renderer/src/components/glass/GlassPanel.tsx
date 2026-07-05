import type { ReactNode } from 'react'

interface GlassPanelProps {
  children: ReactNode
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}

function GlassPanel({
  children,
  title,
  description,
  action,
  className = ''
}: GlassPanelProps) {
  return (
    <section
      className={[
        'rounded-[2rem] border border-white/75 bg-white/50 p-6',
        'shadow-xl shadow-violet-200/20 backdrop-blur-2xl',
        className
      ].join(' ')}
    >
      {(title || description || action) && (
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-xl font-bold text-slate-800">
                {title}
              </h2>
            )}

            {description && (
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {description}
              </p>
            )}
          </div>

          {action && <div>{action}</div>}
        </header>
      )}

      {children}
    </section>
  )
}

export default GlassPanel
