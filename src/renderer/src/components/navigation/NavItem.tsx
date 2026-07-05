import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

interface NavItemProps {
  to: string
  children: ReactNode
  disabled?: boolean
}

function NavItem({ to, children, disabled = false }: NavItemProps) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-2xl px-4 py-2 text-sm font-medium text-slate-400">
        {children}
      </span>
    )
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'cursor-pointer rounded-2xl px-4 py-2 text-sm font-semibold transition duration-200',
          isActive
            ? 'border border-white/70 bg-white/65 text-violet-700 shadow-sm backdrop-blur-xl'
            : 'text-slate-600 hover:bg-white/40 hover:text-slate-900'
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  )
}

export default NavItem
