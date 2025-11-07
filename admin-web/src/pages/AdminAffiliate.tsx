import React, { useEffect, useRef, useState } from 'react'
import { useAdminAuth } from '../contexts/AdminAuthContext'
import { adminApiClient } from '../lib/api'

interface AffiliateConfigState {
  amazonEnabled: boolean
  amazonAssociateId: string
  amazonAccessKey: string
  amazonSecretKey: string
  amazonTag: string
  sitestripeTag: string
  defaultImageUrl: string
  defaultStarValuePence: string
}

const DEFAULT_CONFIG: AffiliateConfigState = {
  amazonEnabled: false,
  amazonAssociateId: '',
  amazonAccessKey: '',
  amazonSecretKey: '',
  amazonTag: '',
  sitestripeTag: '',
  defaultImageUrl: '',
  defaultStarValuePence: '10'
}

const AdminAffiliate: React.FC = () => {
  const { adminLogout } = useAdminAuth()
  const [config, setConfig] = useState<AffiliateConfigState>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      setLoading(true)
      const response = await adminApiClient.getAffiliateConfig()
      const cfg = response?.config || {}
      setConfig({
        amazonEnabled: cfg.amazonEnabled ?? false,
        amazonAssociateId: cfg.amazonAssociateId ?? '',
        amazonAccessKey: cfg.amazonAccessKey ?? '',
        amazonSecretKey: cfg.amazonSecretKey ?? '',
        amazonTag: cfg.amazonTag ?? '',
        sitestripeTag: cfg.sitestripeTag ?? '',
        defaultImageUrl: cfg.defaultImageUrl ?? '',
        defaultStarValuePence: cfg.defaultStarValuePence ? String(cfg.defaultStarValuePence) : '10'
      })
    } catch (err: any) {
      console.error('Failed to load affiliate configuration', err)
      setError(err?.message || 'Failed to load affiliate configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleFieldChange = (field: keyof AffiliateConfigState, value: string | boolean) => {
    setConfig(prev => ({
      ...prev,
      [field]: typeof value === 'string' ? value : value
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      await adminApiClient.updateAffiliateConfig({
        amazonEnabled: config.amazonEnabled,
        amazonAssociateId: config.amazonAssociateId.trim() || undefined,
        amazonAccessKey: config.amazonAccessKey.trim() || undefined,
        amazonSecretKey: config.amazonSecretKey.trim() || undefined,
        amazonTag: config.amazonTag.trim() || undefined,
        sitestripeTag: config.sitestripeTag.trim() || undefined,
        defaultImageUrl: config.defaultImageUrl.trim() || null,
        defaultStarValuePence: parseInt(config.defaultStarValuePence, 10) || 10
      })

      setSuccess('Affiliate configuration saved successfully')
    } catch (err: any) {
      console.error('Failed to save affiliate configuration', err)
      setError(err?.message || 'Failed to save affiliate configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleUploadDefaultImage = async (file: File) => {
    try {
      setUploading(true)
      setError(null)
      const result = await adminApiClient.uploadImage(file)
      if (result?.imageUrl) {
        setConfig(prev => ({ ...prev, defaultImageUrl: result.imageUrl }))
        setSuccess('Default fallback image uploaded successfully')
      }
    } catch (err: any) {
      console.error('Failed to upload fallback image', err)
      setError(err?.message || 'Failed to upload fallback image')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const onSelectFile: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0]
    if (file) {
      await handleUploadDefaultImage(file)
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
          <p className="mt-4 text-gray-600">Loading affiliate configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Affiliate Management</h1>
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

      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Amazon Associates (PA-API)</h3>
            <p className="text-sm text-gray-500 mt-1">
              Enable PA-API to automatically fetch product details when adults create Amazon gifts.
            </p>
          </div>
          <div className="p-6 space-y-6">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={config.amazonEnabled}
                onChange={(e) => handleFieldChange('amazonEnabled', e.target.checked)}
                className="h-5 w-5 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Enable Amazon Associates (PA-API)</span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Associate ID</label>
                <input
                  type="text"
                  value={config.amazonAssociateId}
                  onChange={(e) => handleFieldChange('amazonAssociateId', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="your-associate-id"
                  disabled={!config.amazonEnabled}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tracking Tag</label>
                <input
                  type="text"
                  value={config.amazonTag}
                  onChange={(e) => handleFieldChange('amazonTag', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="choreblimey-21"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Access Key</label>
                <input
                  type="text"
                  value={config.amazonAccessKey}
                  onChange={(e) => handleFieldChange('amazonAccessKey', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="AWS access key"
                  disabled={!config.amazonEnabled}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Secret Key</label>
                <input
                  type="password"
                  value={config.amazonSecretKey}
                  onChange={(e) => handleFieldChange('amazonSecretKey', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="AWS secret key"
                  disabled={!config.amazonEnabled}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">SiteStripe / Fallback Tracking</h3>
            <p className="text-sm text-gray-500 mt-1">
              Provide the tracking ID to append to SiteStripe links when PA-API is not available.
            </p>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Default Tracking Tag</label>
              <input
                type="text"
                value={config.sitestripeTag}
                onChange={(e) => handleFieldChange('sitestripeTag', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="choreblimey-21"
              />
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-1">Default Star Conversion Rate</h4>
              <p className="text-xs text-gray-500 mb-3">
                Used when auto-suggesting star costs for Amazon products. Example: with the default 10p per star, a £10 item becomes 100 stars. Families can override the star value when creating gifts.
              </p>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">1 star =</span>
                <input
                  type="number"
                  min="1"
                  value={config.defaultStarValuePence}
                  onChange={(e) => handleFieldChange('defaultStarValuePence', e.target.value)}
                  className="mt-1 block w-32 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-sm text-gray-600">pence</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Fallback Product Image</h4>
                  <p className="text-xs text-gray-500">
                    Used when we cannot retrieve an image from Amazon.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={onSelectFile}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                  >
                    {uploading ? 'Uploading...' : 'Upload Image'}
                  </button>
                  {config.defaultImageUrl && (
                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, defaultImageUrl: '' }))}
                      className="inline-flex items-center px-3 py-2 border border-red-200 text-sm font-medium rounded-md text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {config.defaultImageUrl ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center space-x-4">
                  <img src={config.defaultImageUrl} alt="Fallback" className="w-24 h-24 object-cover rounded" />
                  <span className="text-sm text-gray-600 break-all">{config.defaultImageUrl}</span>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No fallback image configured.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminAffiliate

