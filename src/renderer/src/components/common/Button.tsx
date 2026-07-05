import type {
  ButtonHTMLAttributes,
  ReactNode
} from 'react'

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
}

function Button({
  children,
  type = 'button',
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      'bg-gradient-to-r from-emerald-400 to-violet-500 text-white shadow-lg',
    secondary:
      'border border-white/70 bg-white/55 text-slate-700',
    danger:
      'bg-rose-400 text-white'
  }

  return (
    <button
      type={type}
      className={[
        'inline-flex cursor-pointer items-center justify-center rounded-2xl px-5 py-3 font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button