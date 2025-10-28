import React, { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api'

const TokenHandler: React.FC = () => {
  const location = useLocation()
  const { isAuthenticated, login } = useAuth()
  const processingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  
  const urlParams = new URLSearchParams(location.search)
  const token = urlParams.get('token')

  useEffect(() => {
    // Prevent multiple calls to the same token
    if (!token || isAuthenticated || processingRef.current) {
      return
    }
    
    console.log('TokenHandler: Processing token from URL:', token)
    processingRef.current = true
    
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
          setError('Invalid response from server')
          processingRef.current = false
        }
      })
      .catch(error => {
        console.error('TokenHandler: Magic link callback error:', error)
        setError(error.message || 'Failed to process magic link')
        processingRef.current = false
      })
  }, [token, isAuthenticated, login])

  // If authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  // If no token in URL, redirect to login
  if (!token) {
    return <Navigate to="/login" replace />
  }

  // Show error if token processing failed
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Magic Link Failed</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <a 
            href="/login" 
            className="inline-block px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Back to Login
          </a>
        </div>
      </div>
    )
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
