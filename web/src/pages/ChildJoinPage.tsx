import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api'

const ChildJoinPage: React.FC = () => {
  const [formData, setFormData] = useState({
    code: '',
    nickname: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [useQRCode, setUseQRCode] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleQRScan = (qrData: string) => {
    try {
      const parsed = JSON.parse(qrData)
      if (parsed.type === 'child_join' && parsed.code) {
        setFormData(prev => ({ 
          ...prev, 
          code: parsed.code 
        }))
        setMessage('QR code scanned successfully!')
      } else {
        setMessage('Invalid QR code for child join')
      }
    } catch (error) {
      setMessage('Invalid QR code format')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')

    if (!formData.nickname.trim()) {
      setMessage('Please enter a nickname')
      setIsLoading(false)
      return
    }

    if (!useQRCode && !formData.code.trim()) {
      setMessage('Please enter a join code')
      setIsLoading(false)
      return
    }

    try {
      const joinData = {
        nickname: formData.nickname.trim(),
        ...(useQRCode && formData.code ? { qrData: JSON.stringify({ type: 'child_join', code: formData.code }) } : { code: formData.code.toUpperCase() })
      }

      const response = await apiClient.childJoin(joinData)
      
      if (response.token && response.child) {
        login(response.token, {
          id: response.child.id,
          role: 'child_player',
          familyId: response.family.id,
          childId: response.child.id,
          ageGroup: response.child.ageGroup,
          nickname: response.child.nickname
        })
        navigate('/child-dashboard')
      } else {
        setMessage('Failed to join family')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to join family')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            Join Your Family! 🏠
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Enter your join code to start earning rewards
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="flex justify-center space-x-4">
              <button
                type="button"
                onClick={() => {
                  setUseQRCode(false)
                  setMessage('')
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !useQRCode 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                📝 Enter Code
              </button>
              <button
                type="button"
                onClick={() => {
                  setUseQRCode(true)
                  setMessage('QR code scanning not implemented yet - use text code')
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  useQRCode 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                📱 Scan QR
              </button>
            </div>

            {!useQRCode && (
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-foreground mb-2">
                  Family Join Code
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  value={formData.code}
                  onChange={handleInputChange}
                  placeholder="Enter the code from your parent"
                  className="relative block w-full px-3 py-2 border border-input bg-background text-foreground placeholder-muted-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary uppercase"
                />
              </div>
            )}

            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-foreground mb-2">
                Your Nickname
              </label>
              <input
                id="nickname"
                name="nickname"
                type="text"
                required
                value={formData.nickname}
                onChange={handleInputChange}
                placeholder="What should we call you?"
                className="relative block w-full px-3 py-2 border border-input bg-background text-foreground placeholder-muted-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Joining...' : 'Join Family! 🎉'}
            </button>
          </div>

          {message && (
            <div className={`text-sm text-center p-3 rounded-md ${
              message.includes('success') 
                ? 'bg-success/10 text-success border border-success/20' 
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}>
              {message}
            </div>
          )}
        </form>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Don't have a join code? Ask your parent to create one for you!
          </p>
        </div>
      </div>
    </div>
  )
}

export default ChildJoinPage
