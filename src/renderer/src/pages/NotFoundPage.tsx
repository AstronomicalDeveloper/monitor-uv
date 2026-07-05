import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <section className="flex min-h-[70vh] items-center justify-center">
      <div className="text-center">
        <p className="text-7xl font-bold text-violet-400">
          404
        </p>

        <h1 className="mt-4 text-2xl font-bold">
          Pantalla no encontrada
        </h1>

        <Link
          to="/monitoreo"
          className="mt-6 inline-flex rounded-xl bg-violet-500 px-5 py-3 font-semibold text-white transition hover:bg-violet-600"
        >
          Ir al monitoreo
        </Link>
      </div>
    </section>
  )
}

export default NotFoundPage