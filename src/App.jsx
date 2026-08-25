import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import AIAssistant from './pages/AIAssistant'
import Dashboard from './pages/Dashboard'
import Finance from './pages/Finance'
import Inventory from './pages/Inventory'
import Login from './pages/Login'
import Payroll from './pages/Payroll'

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/barang" element={<Inventory />} />
                <Route path="/keuangan" element={<Finance />} />
                <Route path="/gaji" element={<Payroll />} />
                <Route path="/asisten" element={<AIAssistant />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return <AppRoutes />
}

export default App
