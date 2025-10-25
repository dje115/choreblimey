import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api'

const TokenHandler: React.FC = () => {
  const location = useLocation()
  const { isAuthenticated, login } = useAuth()
  
  const urlParams = new URLSearchParams(location.search)
  const token = urlParams.get('token')

  useEffect(() => {
    console.log('TokenHandler: useEffect triggered', { token, isAuthenticated })
    
    if (token && !isAuthenticated) {
      console.log('TokenHandler: Processing token from URL:', token)
      
      apiClient.callback(token)
        .then(response => {
          console.log('TokenHandler: API callback response:', response)
          
          if (response.token && response.user) {
            const userData = {
              id: response.user.id,
              email: response.user.email,
              role: response.user.role,
              familyId: response.familyId || ''
            }
            
            console.log('TokenHandler: Login successful, redirecting...')
            login(response.token, userData)
            
            // Clear the token from URL
            window.history.replaceState({}, document.title, window.location.pathname)
          } else {
            console.error('TokenHandler: Invalid response from callback')
          }
        })
        .catch(error => {
          console.error('TokenHandler: Magic link callback error:', error)
        })
    }
  }, [token, isAuthenticated, login])

  // If authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  // If no token in URL, redirect to login
  if (!token) {
    return <Navigate to="/login" replace />
  }

  // Show loading while processing token
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Processing magic link...</p>
      </div>
    </div>
  )
}

export default TokenHandler
