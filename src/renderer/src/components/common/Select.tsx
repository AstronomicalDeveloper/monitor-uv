import type {
  ChangeEventHandler,
  ReactNode
} from 'react'

interface SelectProps {
  id: string
  label: string
  value: string
  onChange: ChangeEventHandler<HTMLSelectElement>
  disabled?: boolean
  children: ReactNode
}

function Select({
  id,
  label,
  value,
  onChange,
  disabled = false,
  children
}: SelectProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-slate-700"
      >
        {label}
      </label>

      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full rounded-2xl border border-white/80 bg-white/60 px-4 py-3 text-slate-700 outline-none backdrop-blur-xl transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {children}
      </select>
    </div>
  )
}

export default Select
