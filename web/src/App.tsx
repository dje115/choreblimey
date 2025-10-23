import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './theme/ThemeProvider'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import TokenHandler from './components/TokenHandler'

// Pages
import LoginPage from './pages/LoginPage'
import ParentDashboard from './pages/ParentDashboard'
import ChildDashboard from './pages/ChildDashboard'
import ChoreManagement from './pages/ChoreManagement'
import ChildJoinPage from './pages/ChildJoinPage'
import AdminLogin from './pages/AdminLogin'
import AdminSignup from './pages/AdminSignup'
import AdminTwoFactor from './pages/AdminTwoFactor'
import AdminEmailVerify from './pages/AdminEmailVerify'
import AdminMailConfig from './pages/AdminMailConfig'
import AdminAffiliateConfig from './pages/AdminAffiliateConfig'
import AdminDashboard from './pages/AdminDashboard'

// Component to access auth context for theme
const AppContent = () => {
  const { user } = useAuth()
  
  // Map ageGroup to theme age format
  const getThemeAge = (): 'kid_5_8' | 'tween_9_11' | 'teen_12_15' | null => {
    if (user?.role !== 'child_player' || !user?.ageGroup) return null
    
    const age = user.ageGroup
    if (age === '5-8') return 'kid_5_8'
    if (age === '9-11') return 'tween_9_11'
    if (age === '12-15') return 'teen_12_15'
    return 'kid_5_8' // Default to kid
  }
  
  return (
    <ThemeProvider role={user?.role as any} age={getThemeAge()}>
      <Router>
        <div className="min-h-screen bg-background text-foreground">
          <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/child-join" element={<ChildJoinPage />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/signup" element={<AdminSignup />} />
              <Route path="/admin/2fa" element={<AdminTwoFactor />} />
              <Route path="/admin/verify-email" element={<AdminEmailVerify />} />
              <Route path="/admin/mail-config" element={<AdminMailConfig />} />
            <Route path="/admin/affiliate-config" element={<AdminAffiliateConfig />} />
              
              {/* Root route with potential token */}
              <Route path="/" element={<TokenHandler />} />
              
              {/* Protected routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute allowedRoles={['parent_admin', 'parent_viewer', 'relative_contributor']}>
                  <ParentDashboard />
                </ProtectedRoute>
              } />
              <Route path="/chores" element={
                <ProtectedRoute allowedRoles={['parent_admin', 'parent_viewer']}>
                  <ChoreManagement />
                </ProtectedRoute>
              } />
              <Route path="/child-dashboard" element={
                <ProtectedRoute allowedRoles={['child_player']}>
                  <ChildDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={<AdminDashboard />} />
              
              {/* Catch all for unknown routes */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </div>
        </Router>
      </ThemeProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
