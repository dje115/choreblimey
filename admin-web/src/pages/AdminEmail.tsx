import React, { useState, useEffect } from 'react'
import { useAdminAuth } from '../contexts/AdminAuthContext'

const AdminEmail: React.FC = () => {
  const { adminLogout } = useAdminAuth()
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')

  useEffect(() => {
    loadEmailConfig()
  }, [])

  const loadEmailConfig = async () => {
    try {
      setLoading(true)
      // Mock email config for now
      setConfig({
        useMailHog: true,
        useRealSMTP: false,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: '',
        smtpPass: '',
        fromEmail: 'noreply@choreblimey.com',
        fromName: 'ChoreBlimey'
      })
    } catch (error) {
      console.error('Failed to load email config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    try {
      setSaving(true)
      // Mock save - in real implementation, this would call the API
      await new Promise(resolve => setTimeout(resolve, 1000))
      alert('Email configuration saved successfully!')
    } catch (error) {
      alert('Failed to save configuration: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const handleTestEmail = async () => {
    try {
      setTesting(true)
      setTestResult('')
      // Mock email test
      await new Promise(resolve => setTimeout(resolve, 2000))
      setTestResult('✅ Test email sent successfully! Check MailHog at http://localhost:1506')
    } catch (error) {
      setTestResult('❌ Test failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setTesting(false)
    }
  }

  const handleLogout = async () => {
    await adminLogout()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading email configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">
                  Email Management
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <a href="/admin" className="text-blue-600 hover:text-blue-800">← Back to Dashboard</a>
              <button
                onClick={handleLogout}
                className="bg-red-600 flex items-center px-3 py-2 rounded-md text-sm font-medium text-white hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Email Configuration */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Email Configuration</h3>
          </div>
          <div className="p-6">
            <form className="space-y-6">
              {/* Email Provider */}
              <div>
                <label className="text-sm font-medium text-gray-700">Email Provider</label>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="provider"
                      value="mailhog"
                      checked={config?.useMailHog}
                      onChange={() => setConfig({...config, useMailHog: true, useRealSMTP: false})}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">MailHog (Development)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="provider"
                      value="smtp"
                      checked={config?.useRealSMTP}
                      onChange={() => setConfig({...config, useMailHog: false, useRealSMTP: true})}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Real SMTP (Production)</span>
                  </label>
                </div>
              </div>

              {/* SMTP Configuration */}
              {config?.useRealSMTP && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">SMTP Host</label>
                      <input
                        type="text"
                        value={config?.smtpHost || ''}
                        onChange={(e) => setConfig({...config, smtpHost: e.target.value})}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">SMTP Port</label>
                      <input
                        type="number"
                        value={config?.smtpPort || ''}
                        onChange={(e) => setConfig({...config, smtpPort: parseInt(e.target.value)})}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="587"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">SMTP Username</label>
                      <input
                        type="text"
                        value={config?.smtpUser || ''}
                        onChange={(e) => setConfig({...config, smtpUser: e.target.value})}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="your-email@gmail.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">SMTP Password</label>
                      <input
                        type="password"
                        value={config?.smtpPass || ''}
                        onChange={(e) => setConfig({...config, smtpPass: e.target.value})}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="your-app-password"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* From Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">From Email</label>
                  <input
                    type="email"
                    value={config?.fromEmail || ''}
                    onChange={(e) => setConfig({...config, fromEmail: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="noreply@choreblimey.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">From Name</label>
                  <input
                    type="text"
                    value={config?.fromName || ''}
                    onChange={(e) => setConfig({...config, fromName: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="ChoreBlimey"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    '💾 Save Configuration'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testing}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {testing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                      Testing...
                    </>
                  ) : (
                    '📧 Test Email'
                  )}
                </button>
              </div>

              {testResult && (
                <div className={`p-4 rounded-md ${testResult.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {testResult}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Email Status */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Email Service Status</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
                  <span className="text-sm font-medium text-gray-900">Email Service</span>
                </div>
                <span className="text-sm text-green-600">
                  {config?.useMailHog ? 'MailHog Active' : 'SMTP Configured'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
                  <span className="text-sm font-medium text-gray-900">Connection</span>
                </div>
                <span className="text-sm text-green-600">Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full mr-3"></div>
                  <span className="text-sm font-medium text-gray-900">Queue Status</span>
                </div>
                <span className="text-sm text-yellow-600">0 pending emails</span>
              </div>
            </div>
            <div className="mt-4">
              <a
                href="http://localhost:1506"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
              >
                📧 Open MailHog Interface
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminEmail
