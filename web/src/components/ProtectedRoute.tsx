import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, User } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
  redirectTo?: string
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles,
  redirectTo = '/login'
}) => {
  const { isAuthenticated, user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={redirectTo} replace />
  }

  // Check role permissions if specified
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect based on user role
    if (user.role === 'child_player') {
      return <Navigate to="/child-dashboard" replace />
    } else {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <>{children}</>
}

export default ProtectedRoute
