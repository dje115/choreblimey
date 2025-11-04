import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import apiClient from '../lib/api'

interface AdminAuthContextType {
  isAuthenticated: boolean
  loading: boolean
  adminLogin: (email: string, password: string) => Promise<{ requiresTwoFactor: boolean; message?: string }>
  adminVerifyTwoFactor: (email: string, password: string, code: string) => Promise<void>
  adminLogout: () => Promise<void>
  adminSignup: (email: string, password: string) => Promise<void>
  adminVerifyEmail: (token: string) => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

export const AdminAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('admin_token')
      if (token) {
        // Verify token is still valid by checking expiration (JWT tokens expire in 1 hour)
        try {
          // Simple check: if token exists, assume it's valid
          // The API will return 401 if it's expired, which will trigger redirect
          setIsAuthenticated(true)
        } catch (error) {
          localStorage.removeItem('admin_token')
          setIsAuthenticated(false)
        }
      }
      setLoading(false)
    }
    
    checkAuth()
    
    // Listen for auth failures from API client
    const handleAuthFailure = () => {
      setIsAuthenticated(false)
      setLoading(false)
    }
    window.addEventListener('admin-auth-failed', handleAuthFailure)
    
    return () => {
      window.removeEventListener('admin-auth-failed', handleAuthFailure)
    }
  }, [])

  const adminLogin = async (email: string, password: string) => {
    const response = await apiClient.adminLogin(email, password)
    if (response.requiresTwoFactor) {
      return { requiresTwoFactor: true, message: response.message }
    }
    // This part should ideally not be reached if 2FA is always required for login
    // For now, we'll assume if it doesn't require 2FA, it's a direct login (e.g., during dev)
    localStorage.setItem('admin_token', response.token)
    setIsAuthenticated(true)
    return { requiresTwoFactor: false }
  }

  const adminVerifyTwoFactor = async (email: string, password: string, code: string) => {
    const response = await apiClient.adminVerifyTwoFactor({ email, password, code })
    localStorage.setItem('admin_token', response.token)
    setIsAuthenticated(true)
  }

  const adminLogout = async () => {
    await apiClient.adminLogout()
    localStorage.removeItem('admin_token')
    setIsAuthenticated(false)
  }

  const adminSignup = async (email: string, password: string) => {
    await apiClient.adminSignup(email, password)
  }

  const adminVerifyEmail = async (token: string) => {
    await apiClient.adminVerifyEmail(token)
  }

  return (
    <AdminAuthContext.Provider value={{
      isAuthenticated,
      loading,
      adminLogin,
      adminVerifyTwoFactor,
      adminLogout,
      adminSignup,
      adminVerifyEmail
    }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext)
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return context
}