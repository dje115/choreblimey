import React, { useState, useEffect } from 'react'
import { useAdminAuth } from '../contexts/AdminAuthContext'

const AdminAffiliate: React.FC = () => {
  const { adminLogout } = useAdminAuth()
  const [config, setConfig] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    loadAffiliateData()
  }, [])

  const loadAffiliateData = async () => {
    try {
      setLoading(true)
      // Mock affiliate config
      setConfig({
        amazonAssociateId: '',
        amazonAccessKey: '',
        amazonSecretKey: '',
        amazonTag: '',
        sitestripeApiKey: '',
        sitestripeSecretKey: '',
        enabled: false
      })
      
      // Mock products
      setProducts([
        { id: 1, name: 'LEGO Classic Creative Building Set', price: 29.99, category: 'Toys', active: true },
        { id: 2, name: 'Amazon Fire HD 8 Tablet', price: 79.99, category: 'Electronics', active: true },
        { id: 3, name: 'Melissa & Doug Wooden Building Blocks', price: 24.99, category: 'Toys', active: false }
      ])
    } catch (error) {
      console.error('Failed to load affiliate data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    try {
      // Mock save
      await new Promise(resolve => setTimeout(resolve, 1000))
      alert('Affiliate configuration saved successfully!')
    } catch (error) {
      alert('Failed to save configuration: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleSyncProducts = async () => {
    try {
      setSyncing(true)
      // Mock sync
      await new Promise(resolve => setTimeout(resolve, 3000))
      alert('Product sync completed! Found 15 new products.')
      loadAffiliateData() // Refresh
    } catch (error) {
      alert('Failed to sync products: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSyncing(false)
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">
                  Affiliate Management
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
        {/* Amazon Configuration */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Amazon Associates Configuration</h3>
          </div>
          <div className="p-6">
            <form className="space-y-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="amazonEnabled"
                  checked={config?.enabled}
                  onChange={(e) => setConfig({...config, enabled: e.target.checked})}
                  className="mr-2"
                />
                <label htmlFor="amazonEnabled" className="text-sm font-medium text-gray-700">
                  Enable Amazon Associates
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Associate ID</label>
                  <input
                    type="text"
                    value={config?.amazonAssociateId || ''}
                    onChange={(e) => setConfig({...config, amazonAssociateId: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="your-associate-id"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Access Key</label>
                  <input
                    type="text"
                    value={config?.amazonAccessKey || ''}
                    onChange={(e) => setConfig({...config, amazonAccessKey: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="your-access-key"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Secret Key</label>
                  <input
                    type="password"
                    value={config?.amazonSecretKey || ''}
                    onChange={(e) => setConfig({...config, amazonSecretKey: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="your-secret-key"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tag</label>
                  <input
                    type="text"
                    value={config?.amazonTag || ''}
                    onChange={(e) => setConfig({...config, amazonTag: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="your-tag"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveConfig}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                💾 Save Amazon Configuration
              </button>
            </form>
          </div>
        </div>

        {/* SiteStripe Configuration */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">SiteStripe Configuration</h3>
          </div>
          <div className="p-6">
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">API Key</label>
                  <input
                    type="text"
                    value={config?.sitestripeApiKey || ''}
                    onChange={(e) => setConfig({...config, sitestripeApiKey: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="your-sitestripe-api-key"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Secret Key</label>
                  <input
                    type="password"
                    value={config?.sitestripeSecretKey || ''}
                    onChange={(e) => setConfig({...config, sitestripeSecretKey: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="your-sitestripe-secret-key"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveConfig}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                💾 Save SiteStripe Configuration
              </button>
            </form>
          </div>
        </div>

        {/* Product Management */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Product Catalog</h3>
              <button
                onClick={handleSyncProducts}
                disabled={syncing}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
              >
                {syncing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Syncing...
                  </>
                ) : (
                  '🔄 Sync Products'
                )}
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{product.category}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">${product.price}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          product.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {product.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                        <button className="text-red-600 hover:text-red-900">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminAffiliate
