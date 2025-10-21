import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api'

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')

    try {
      await apiClient.signupParent(email)
      setMessage('✅ Magic link sent! Check your email inbox.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to send magic link')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  return (
    <div className="cb-app-shell flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="cb-card text-center pb-8">
          <div className="cb-card-bar mx-auto mb-6">
            <span role="img" aria-label="sparkle">✨</span>
            Turn chores into cheers!
          </div>
          <h1 className="cb-heading-xl" style={{ color: 'var(--primary)' }}>
            ChoreBlimey!
          </h1>
          <p className="cb-body mt-3">
            Passwordless magic links keep things safe and simple.
          </p>
        </div>

        <div className="cb-card">
          <div className="text-center mb-8">
            <h2 className="cb-heading-lg" style={{ color: 'var(--primary)' }}>
              Welcome back
            </h2>
            <p className="cb-body mt-2">
              Enter your email and we’ll send you a magic link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-left">
              <label htmlFor="email" className="block text-sm font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-4 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] bg-white text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-4 focus:ring-[var(--secondary)] focus:border-[var(--secondary)] transition-all"
                placeholder="parent@family.co.uk"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full cb-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                'Sending Magic Link…'
              ) : (
                'Send Magic Link'
              )}
            </button>

            {message && (
              <div
                className={`text-sm p-4 rounded-[var(--radius-md)] border-2 ${
                  message.includes('✅')
                    ? 'bg-[rgba(0,200,151,0.12)] text-[var(--success)] border-[rgba(0,200,151,0.3)]'
                    : 'bg-[rgba(231,76,60,0.12)] text-[var(--danger)] border-[rgba(231,76,60,0.3)]'
                }`}
              >
                {message}
              </div>
            )}
          </form>

          <div className="mt-8 text-center">
            <p className="cb-body mb-4">
              New to ChoreBlimey? Your first login creates your family hub.
            </p>
            <Link
              to="/child-join"
              className="font-bold text-[var(--secondary)] hover:opacity-80 transition-opacity"
            >
              Are you a kid? Join with your family code →
            </Link>
          </div>
        </div>

        <div className="text-center">
          <p className="cb-body">
            Secure, fun, and family-friendly. 🌈
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
