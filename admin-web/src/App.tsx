// import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext'
import AdminLogin from './pages/AdminLogin'
import AdminSignup from './pages/AdminSignup'
import AdminDashboard from './pages/AdminDashboard'
import AdminCleanup from './pages/AdminCleanup'
import AdminEmail from './pages/AdminEmail'
import AdminAffiliate from './pages/AdminAffiliate'
import AdminMonitoring from './pages/AdminMonitoring'
import AdminSecurity from './pages/AdminSecurity'
import AdminSettings from './pages/AdminSettings'

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAdminAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <AdminAuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* Public routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/signup" element={<AdminSignup />} />
            
            {/* Protected admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } />
                    <Route path="/admin/cleanup" element={
                      <ProtectedRoute>
                        <AdminCleanup />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/email" element={
                      <ProtectedRoute>
                        <AdminEmail />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/affiliate" element={
                      <ProtectedRoute>
                        <AdminAffiliate />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/monitoring" element={
                      <ProtectedRoute>
                        <AdminMonitoring />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/security" element={
                      <ProtectedRoute>
                        <AdminSecurity />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/settings" element={
                      <ProtectedRoute>
                        <AdminSettings />
                      </ProtectedRoute>
                    } />
            
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </Router>
    </AdminAuthProvider>
  )
}

export default App
