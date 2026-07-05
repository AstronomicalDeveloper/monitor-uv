import type { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  padding?: string
  solid?: boolean
}

function GlassCard({
  children,
  className = '',
  padding = 'p-5',
  solid = false
}: GlassCardProps) {
  return (
    <article
      className={[
        'rounded-3xl border border-white/70 shadow-lg shadow-violet-200/20',
        solid
          ? 'bg-white/85'
          : 'bg-white/50 backdrop-blur-2xl',
        padding,
        className
      ].join(' ')}
    >
      {children}
    </article>
  )
}

export default GlassCard
