import NavItem from './NavItem'
import ConnectionIndicator from './ConnectionIndicator'
import { useApp } from '../../context/AppContext'

function Navbar() {
  const {
    connected,
    connectedPort,
    capturing
  } = useApp()

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-6 pt-5">
      <nav className="mx-auto flex max-w-7xl items-center gap-6 rounded-3xl border border-white/70 bg-white/45 px-5 py-3 shadow-lg shadow-violet-200/20 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 to-violet-400 font-bold text-white shadow-md">
            UV
          </div>

          <div>
            <p className="font-bold text-slate-800">
              Monitor UV
            </p>

            <p className="text-xs text-slate-500">
              Monitoreo ambiental
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center gap-1">
          <NavItem to="/monitoreo">
            <span className="flex items-center gap-2">
              Monitoreo

              {capturing && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              )}
            </span>
          </NavItem>

          <NavItem
            to="/captura/nueva"
            disabled={!connected || capturing}
          >
            Nueva captura
          </NavItem>

          <NavItem to="/historial">
            Historial
          </NavItem>

          <NavItem to="/reportes">
            Reportes
          </NavItem>
        </div>

        <ConnectionIndicator
          connected={connected}
          portName={connectedPort}
        />
      </nav>
    </header>
  )
}

export default Navbar
