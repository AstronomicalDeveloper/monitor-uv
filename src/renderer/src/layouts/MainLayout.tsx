import { Outlet } from 'react-router-dom'
import Navbar from '../components/navigation/Navbar'

function MainLayout() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-linear-to-br from-emerald-50 via-slate-50 to-violet-100 text-slate-800">
      <div className="pointer-events-none fixed -left-24 top-20 h-96 w-96 rounded-full bg-emerald-200/45 blur-3xl" />

      <div className="pointer-events-none fixed -right-24 top-44 h-112 w-md rounded-full bg-violet-200/50 blur-3xl" />

      <div className="pointer-events-none fixed bottom-0 left-1/3 h-80 w-80 rounded-full bg-blue-100/50 blur-3xl" />

      <Navbar />

      <main className="relative z-10 mx-auto max-w-7xl p-8 pt-32">
        <Outlet />
      </main>
    </div>
  )
}

export default MainLayout