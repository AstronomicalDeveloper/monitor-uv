import type { ReactNode } from 'react'

interface GlassModalProps {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}

function GlassModal({
  open,
  title,
  description,
  children,
  footer,
  onClose
}: GlassModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-6 mt-20">
      <button
        type="button"
        aria-label="Cerrar ventana"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-900/45 backdrop-blur-sm"
      />

      <section className="relative z-10 w-full max-w-lg rounded-4xl border border-white/80 bg-white/75 p-7 shadow-2xl shadow-violet-300/30 backdrop-blur-3xl">
        <header>
          <h2 className="text-2xl font-bold text-slate-800">
            {title}
          </h2>

          {description && (
            <p className="mt-2 leading-6 text-slate-500">
              {description}
            </p>
          )}
        </header>

        <div className="mt-6">{children}</div>

        {footer && (
          <footer className="mt-7 flex justify-end gap-3">
            {footer}
          </footer>
        )}
      </section>
    </div>
  )
}

export default GlassModal
