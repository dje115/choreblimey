import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface MailConfig {
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpFrom: string
  useMailHog: boolean
  useRealSMTP: boolean
}

export default function AdminMailConfig() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<MailConfig>({
    smtpHost: 'mailhog',
    smtpPort: 1025,
    smtpUser: '',
    smtpPass: '',
    smtpFrom: 'noreply@choreblimey.com',
    useMailHog: true,
    useRealSMTP: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    // Load current configuration from environment or localStorage
    const savedConfig = localStorage.getItem('admin_mail_config')
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig))
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Save configuration to server
      const saveResponse = await fetch('http://localhost:1501/v1/admin/email-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (!saveResponse.ok) {
        setError('Failed to save email configuration')
        return
      }
      
      // Test email configuration
      const testResponse = await fetch('http://localhost:1501/v1/admin/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (testResponse.ok) {
        setSuccess('Site email configuration saved and tested successfully!')
      } else {
        setError('Email configuration test failed')
      }
    } catch (err) {
      setError('Failed to save email configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleMailHogToggle = (enabled: boolean) => {
    setConfig(prev => ({
      ...prev,
      useMailHog: enabled
    }))
  }

  const handleRealSMTPToggle = (enabled: boolean) => {
    setConfig(prev => ({
      ...prev,
      useRealSMTP: enabled
    }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Site Email Configuration</h1>
            <p className="mt-2 text-gray-600">Configure email settings for the entire ChoreBlimey platform</p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Development Options */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Site Email Delivery Options</h3>
                <p className="text-sm text-gray-600 mb-4">Configure how emails are delivered across the entire ChoreBlimey platform. You can enable both options for development - emails will be sent to both MailHog and real SMTP.</p>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="useMailHog"
                      checked={config.useMailHog}
                      onChange={(e) => handleMailHogToggle(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="useMailHog" className="ml-2 block text-sm text-gray-900">
                      Use MailHog (Development Email Capture)
                    </label>
                    <span className="ml-2 text-xs text-gray-500">
                      View emails at <a href="http://localhost:1506" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500">http://localhost:1506</a>
                    </span>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="useRealSMTP"
                      checked={config.useRealSMTP}
                      onChange={(e) => handleRealSMTPToggle(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="useRealSMTP" className="ml-2 block text-sm text-gray-900">
                      Use Real SMTP Server (Production Delivery)
                    </label>
                  </div>

                  {!config.useMailHog && !config.useRealSMTP && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <p className="text-sm text-yellow-800">
                        ⚠️ No email delivery method selected. All site emails (admin, family, child notifications) will not be sent.
                      </p>
                    </div>
                  )}

                  {config.useMailHog && config.useRealSMTP && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <p className="text-sm text-blue-800">
                        ✅ Both delivery methods enabled. All site emails (admin, family, child notifications) will be sent to MailHog for development and real SMTP for production testing.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* SMTP Configuration */}
              {config.useRealSMTP && (
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Real SMTP Configuration</h3>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="smtpHost" className="block text-sm font-medium text-gray-700">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        id="smtpHost"
                        value={config.smtpHost}
                        onChange={(e) => setConfig(prev => ({ ...prev, smtpHost: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="smtp.gmail.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="smtpPort" className="block text-sm font-medium text-gray-700">
                        SMTP Port
                      </label>
                      <input
                        type="number"
                        id="smtpPort"
                        value={config.smtpPort}
                        onChange={(e) => setConfig(prev => ({ ...prev, smtpPort: parseInt(e.target.value) }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="587"
                      />
                    </div>

                    <div>
                      <label htmlFor="smtpUser" className="block text-sm font-medium text-gray-700">
                        SMTP Username
                      </label>
                      <input
                        type="text"
                        id="smtpUser"
                        value={config.smtpUser}
                        onChange={(e) => setConfig(prev => ({ ...prev, smtpUser: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="your-email@gmail.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="smtpPass" className="block text-sm font-medium text-gray-700">
                        SMTP Password
                      </label>
                      <input
                        type="password"
                        id="smtpPass"
                        value={config.smtpPass}
                        onChange={(e) => setConfig(prev => ({ ...prev, smtpPass: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="your-app-password"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* From Email Address */}
              <div>
                <label htmlFor="smtpFrom" className="block text-sm font-medium text-gray-700">
                  From Email Address
                </label>
                <input
                  type="email"
                  id="smtpFrom"
                  value={config.smtpFrom}
                  onChange={(e) => setConfig(prev => ({ ...prev, smtpFrom: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="noreply@choreblimey.com"
                />
              </div>

              {/* Status Messages */}
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}

              {success && (
                <div className="rounded-md bg-green-50 p-4">
                  <div className="text-sm text-green-700">{success}</div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save & Test Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Email Types Controlled */}
        <div className="mt-8 bg-green-50 border border-green-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-green-800 mb-2">Site Email Types Controlled</h3>
          <div className="text-sm text-green-700 space-y-1">
            <p><strong>Admin Emails:</strong> Signup verification, 2FA codes, admin notifications</p>
            <p><strong>Family Emails:</strong> Account creation, password resets, family invitations</p>
            <p><strong>Child Emails:</strong> Chore reminders, reward notifications, achievement emails</p>
            <p><strong>System Emails:</strong> Error notifications, maintenance alerts, system updates</p>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Configuration Help</h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p><strong>MailHog (Development):</strong> Emails are captured and can be viewed at <a href="http://localhost:1506" target="_blank" rel="noopener noreferrer" className="underline">http://localhost:1506</a></p>
            <p><strong>Gmail SMTP:</strong> Use your Gmail address and an App Password (not your regular password)</p>
            <p><strong>Other Providers:</strong> Check your email provider's SMTP settings documentation</p>
          </div>
        </div>
      </div>
    </div>
  )
}
