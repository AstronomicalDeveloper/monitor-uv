import {
  HashRouter,
  Navigate,
  Route,
  Routes
} from 'react-router-dom'

import MainLayout from '../layouts/MainLayout'
import ConnectionPage from '../pages/ConnectionPage'
import MonitoringPage from '../pages/MonitoringPage'
import NewCapturePage from '../pages/NewCapturePage'
import HistoryPage from '../pages/HistoryPage'
import HistoryDetailPage from '../pages/HistoryDetailPage'
import ReportsPage from '../pages/ReportsPage'
import ReportDetailPage from '../pages/ReportDetailPage'
import NotFoundPage from '../pages/NotFoundPage'

function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/conexion" replace />}
        />

        <Route
          path="/conexion"
          element={<ConnectionPage />}
        />

        <Route element={<MainLayout />}>
          <Route
            path="/monitoreo"
            element={<MonitoringPage />}
          />

          <Route
            path="/captura/nueva"
            element={<NewCapturePage />}
          />

          <Route
            path="/historial"
            element={<HistoryPage />}
          />

          <Route
            path="/historial/:sessionId"
            element={<HistoryDetailPage />}
          />

          <Route
            path="/reportes"
            element={<ReportsPage />}
          />

          <Route
            path="/reportes/:reportId"
            element={<ReportDetailPage />}
          />

          <Route
            path="*"
            element={<NotFoundPage />}
          />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default AppRouter