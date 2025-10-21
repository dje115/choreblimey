import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api'

const LoginPage: React.FC = () => {
  const [showParentLogin, setShowParentLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const handleParentSubmit = async (e: React.FormEvent) => {
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
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block px-6 py-2 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white font-bold mb-6 text-sm uppercase tracking-wide animate-bounce">
            ✨ Turn chores into cheers! ✨
          </div>
          <h1 className="text-6xl md:text-7xl font-black mb-4" style={{ 
            color: 'var(--primary)',
            textShadow: '3px 3px 0px rgba(45, 155, 240, 0.3)'
          }}>
            ChoreBlimey!
          </h1>
          <p className="text-2xl font-bold text-[var(--text-secondary)]">
            Who are you today?
          </p>
        </div>

        {!showParentLogin ? (
          <>
            {/* Main Choice Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Child Card - PRIMARY */}
              <button
                onClick={() => navigate('/child-join')}
                className="cb-card group hover:scale-105 transition-all duration-300 cursor-pointer border-4 border-[var(--primary)] hover:border-[var(--secondary)] hover:shadow-2xl"
              >
                <div className="cb-card-bar text-center text-lg mb-6">
                  🎮 Kids Click Here! 🎮
                </div>
                
                <div className="text-center py-8">
                  <div className="text-8xl mb-6 animate-pulse">🎉</div>
                  <h2 className="text-3xl font-black mb-4" style={{ color: 'var(--primary)' }}>
                    I'm a Kid!
                  </h2>
                  <p className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                    Join your family with your special code and start earning stars! ⭐
                  </p>
                  
                  <div className="inline-block px-8 py-4 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white rounded-[var(--radius-lg)] font-black text-xl group-hover:scale-110 transition-transform">
                    Let's Go! →
                  </div>
                </div>

                <div className="mt-6 text-center text-sm text-[var(--text-secondary)] space-y-2">
                  <div>✅ Complete chores</div>
                  <div>⭐ Earn stars & money</div>
                  <div>🏆 Beat your siblings!</div>
                </div>
              </button>

              {/* Parent Card - SECONDARY */}
              <button
                onClick={() => setShowParentLogin(true)}
                className="cb-card group hover:scale-105 transition-all duration-300 cursor-pointer border-4 border-[var(--card-border)] hover:border-[var(--primary)] hover:shadow-lg"
              >
                <div className="cb-card-bar text-center text-lg mb-6 bg-gradient-to-r from-purple-500 to-pink-500">
                  👨‍👩‍👧 Parents & Grown-ups 👨‍👩‍👧
                </div>
                
                <div className="text-center py-8">
                  <div className="text-8xl mb-6">👪</div>
                  <h2 className="text-3xl font-black mb-4" style={{ color: 'var(--secondary)' }}>
                    I'm a Parent
                  </h2>
                  <p className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                    Set up chores, manage rewards, and track your family's progress.
                  </p>
                  
                  <div className="inline-block px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-[var(--radius-lg)] font-black text-xl group-hover:scale-110 transition-transform">
                    Parent Login →
                  </div>
                </div>

                <div className="mt-6 text-center text-sm text-[var(--text-secondary)] space-y-2">
                  <div>⚙️ Create & assign chores</div>
                  <div>💰 Set budgets & rewards</div>
                  <div>📊 Track family progress</div>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="text-center">
              <p className="text-lg font-semibold text-[var(--text-secondary)]">
                Secure, fun, and family-friendly! 🌈
              </p>
            </div>
          </>
        ) : (
          /* Parent Login Form */
          <div className="cb-card max-w-md mx-auto">
            <button
              onClick={() => setShowParentLogin(false)}
              className="text-[var(--secondary)] hover:opacity-80 font-semibold mb-6 flex items-center gap-2"
            >
              ← Back to main menu
            </button>

            <div className="text-center mb-8">
              <div className="text-6xl mb-4">👨‍👩‍👧</div>
              <h2 className="cb-heading-lg" style={{ color: 'var(--primary)' }}>
                Parent Login
              </h2>
              <p className="cb-body mt-2">
                We'll send you a secure magic link via email.
              </p>
            </div>

            <form onSubmit={handleParentSubmit} className="space-y-6">
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
                {isLoading ? '✉️ Sending Magic Link…' : '✉️ Send Magic Link'}
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
              <p className="cb-body text-sm text-[var(--text-secondary)]">
                🔐 Passwordless magic links keep things safe and simple.<br />
                First time? Your login creates your family hub.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LoginPage
