import React, { useState, useEffect } from 'react'
import { useAdminAuth } from '../contexts/AdminAuthContext'
import { adminApiClient } from '../lib/api'

const AdminCleanup: React.FC = () => {
  const { adminLogout } = useAdminAuth()
  const [stats, setStats] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [runningCleanup, setRunningCleanup] = useState(false)

  useEffect(() => {
    loadCleanupData()
  }, [])

  const loadCleanupData = async () => {
    try {
      setLoading(true)
      const [statsData, logsData] = await Promise.all([
        adminApiClient.getCleanupStats().catch(() => ({ 
          totalFamilies: 0, 
          inactiveFamilies: 0, 
          suspendedFamilies: 0, 
          deletedFamilies: 0 
        })),
        adminApiClient.getCleanupLogs({ limit: 50 }).catch(() => [])
      ])
      
      setStats(statsData)
      setLogs(logsData)
    } catch (error) {
      console.error('Failed to load cleanup data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleManualCleanup = async () => {
    if (!confirm('Are you sure you want to run manual cleanup? This will delete inactive accounts.')) {
      return
    }

    try {
      setRunningCleanup(true)
      await adminApiClient.triggerCleanup()
      alert('Manual cleanup triggered successfully!')
      loadCleanupData() // Refresh data
    } catch (error) {
      alert('Failed to trigger cleanup: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setRunningCleanup(false)
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
          <p className="mt-4 text-gray-600">Loading cleanup data...</p>
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
                  Account Cleanup Management
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
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">👥</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Families</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats?.totalFamilies || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">⏰</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Inactive (6+ months)</dt>
                    <dd className="text-lg font-medium text-yellow-600">{stats?.inactiveFamilies || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">⚠️</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Suspended (12+ months)</dt>
                    <dd className="text-lg font-medium text-orange-600">{stats?.suspendedFamilies || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">🗑️</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Deleted This Month</dt>
                    <dd className="text-lg font-medium text-red-600">{stats?.deletedFamilies || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Manual Actions */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Manual Actions</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Run Manual Cleanup</h4>
                  <p className="text-sm text-gray-500">Trigger cleanup process immediately</p>
                </div>
                <button
                  onClick={handleManualCleanup}
                  disabled={runningCleanup}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {runningCleanup ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Running...
                    </>
                  ) : (
                    '🧹 Run Cleanup Now'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Cleanup Logs */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Cleanup Activity</h3>
          </div>
          <div className="p-6">
            {logs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No cleanup logs available</p>
              </div>
            ) : (
              <div className="flow-root">
                <ul className="-mb-8">
                  {logs.map((log, index) => (
                    <li key={index}>
                      <div className="relative pb-8">
                        {index < logs.length - 1 && (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                        )}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                              log.type === 'deletion' ? 'bg-red-500' : 
                              log.type === 'warning' ? 'bg-yellow-500' : 
                              'bg-green-500'
                            }`}>
                              <span className="text-white text-xs">
                                {log.type === 'deletion' ? '🗑️' : 
                                 log.type === 'warning' ? '⚠️' : '✅'}
                              </span>
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-500">
                                <span className="font-medium text-gray-900">{log.action}</span>
                                {log.details && <span className="ml-1">{log.details}</span>}
                              </p>
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              <time>{new Date(log.timestamp).toLocaleString()}</time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminCleanup