import AppRouter from './router/AppRouter'
import { AppProvider } from './context/AppContext'

function App(): React.JSX.Element {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  )
}

export default App
