import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Product Search Test Component
function ProductSearchTest() {
  const [searchQuery, setSearchQuery] = useState('')
  const [ageTag, setAgeTag] = useState<'toddler_2_4' | 'kid_5_8' | 'tween_9_11' | 'teen_12_15' | 'young_adult_16_18' | 'all_ages'>('all_ages')
  const [genderTag, setGenderTag] = useState<'male' | 'female' | 'both' | 'unisex'>('both')
  const [category, setCategory] = useState('')
  const [maxResults, setMaxResults] = useState(5)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState('')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setLoading(true)
    setError('')
    setResults([])

    try {
      const response = await fetch('http://localhost:1501/v1/admin/search-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          ageTag,
          genderTag,
          category: category || undefined,
          maxResults
        }),
      })

      const data = await response.json()
      if (data.success) {
        setResults(data.products)
      } else {
        setError(data.error || 'Search failed')
      }
    } catch (err) {
      setError('Failed to search products')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="search_query" className="block text-sm font-medium text-gray-700">
              Search Query
            </label>
            <input
              type="text"
              id="search_query"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="e.g., toys, books, games"
              required
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              Category (Optional)
            </label>
            <input
              type="text"
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="e.g., toys, books, electronics"
            />
          </div>

          <div>
            <label htmlFor="age_tag" className="block text-sm font-medium text-gray-700">
              Age Group
            </label>
            <select
              id="age_tag"
              value={ageTag}
              onChange={(e) => setAgeTag(e.target.value as any)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="all_ages">All Ages</option>
              <option value="toddler_2_4">Toddler (2-4)</option>
              <option value="kid_5_8">Kids (5-8)</option>
              <option value="tween_9_11">Tweens (9-11)</option>
              <option value="teen_12_15">Teens (12-15)</option>
              <option value="young_adult_16_18">Young Adult (16-18)</option>
            </select>
          </div>

          <div>
            <label htmlFor="gender_tag" className="block text-sm font-medium text-gray-700">
              Gender
            </label>
            <select
              id="gender_tag"
              value={genderTag}
              onChange={(e) => setGenderTag(e.target.value as any)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="both">Both</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="unisex">Unisex</option>
            </select>
          </div>

          <div>
            <label htmlFor="max_results" className="block text-sm font-medium text-gray-700">
              Max Results
            </label>
            <input
              type="number"
              id="max_results"
              value={maxResults}
              onChange={(e) => setMaxResults(parseInt(e.target.value))}
              min="1"
              max="20"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search Products'}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Search Results ({results.length})</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((product, index) => (
              <div key={index} className="border border-gray-200 rounded-md p-3">
                <div className="flex items-start space-x-3">
                  {product.image && (
                    <img
                      src={product.image}
                      alt={product.title}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-medium text-gray-900 truncate">{product.title}</h5>
                    <p className="text-sm text-gray-600">{product.price}</p>
                    <div className="mt-1 flex space-x-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {product.ageTag?.replace('_', ' ')}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {product.genderTag}
                      </span>
                    </div>
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-blue-600 hover:text-blue-800"
                    >
                      View Product →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface AffiliateConfig {
  primaryProvider: 'amazon_pa_api' | 'sitestripe'
  providers: {
    amazon_pa_api: {
      enabled: boolean
      config: {
        accessKey: string
        secretKey: string
        partnerTag: string
        region: string
      }
    }
    sitestripe: {
      enabled: boolean
      config: {
        apiKey: string
        secretKey: string
        affiliateId: string
        region: string
      }
    }
  }
}

export default function AdminAffiliateConfig() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<AffiliateConfig>({
    primaryProvider: 'amazon_pa_api',
    providers: {
      amazon_pa_api: {
        enabled: true,
        config: {
          accessKey: '',
          secretKey: '',
          partnerTag: '',
          region: 'us-east-1'
        }
      },
      sitestripe: {
        enabled: false,
        config: {
          apiKey: '',
          secretKey: '',
          affiliateId: '',
          region: 'us'
        }
      }
    }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    // Load saved configuration
    const savedConfig = localStorage.getItem('admin_affiliate_config')
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
      const saveResponse = await fetch('http://localhost:1501/v1/admin/affiliate-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (!saveResponse.ok) {
        setError('Failed to save affiliate configuration')
        return
      }
      
      setSuccess('Affiliate configuration saved successfully!')
    } catch (err) {
      setError('Failed to save affiliate configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleProviderToggle = (provider: 'amazon_pa_api' | 'sitestripe', enabled: boolean) => {
    setConfig(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [provider]: {
          ...prev.providers[provider],
          enabled
        }
      }
    }))
  }

  const handlePrimaryProviderChange = (provider: 'amazon_pa_api' | 'sitestripe') => {
    setConfig(prev => ({
      ...prev,
      primaryProvider: provider
    }))
  }

  const testProvider = async (provider: 'amazon_pa_api' | 'sitestripe') => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('http://localhost:1501/v1/admin/test-affiliate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider }),
      })

      const result = await response.json()
      if (result.success) {
        setSuccess(`${provider === 'amazon_pa_api' ? 'Amazon PA-API' : 'SiteStripe'} test successful!`)
      } else {
        setError(`${provider === 'amazon_pa_api' ? 'Amazon PA-API' : 'SiteStripe'} test failed: ${result.result?.error}`)
      }
    } catch (err) {
      setError(`Failed to test ${provider === 'amazon_pa_api' ? 'Amazon PA-API' : 'SiteStripe'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Affiliate Provider Configuration</h1>
            <p className="mt-2 text-gray-600">Configure Amazon affiliate providers for ChoreBlimey rewards</p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Primary Provider Selection */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Primary Affiliate Provider</h3>
                <p className="text-sm text-gray-600 mb-4">Choose which provider to use for product searches and rewards.</p>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="amazon_pa_api"
                      name="primaryProvider"
                      value="amazon_pa_api"
                      checked={config.primaryProvider === 'amazon_pa_api'}
                      onChange={() => handlePrimaryProviderChange('amazon_pa_api')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <label htmlFor="amazon_pa_api" className="ml-2 block text-sm text-gray-900">
                      Amazon Product Advertising API (Direct)
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="sitestripe"
                      name="primaryProvider"
                      value="sitestripe"
                      checked={config.primaryProvider === 'sitestripe'}
                      onChange={() => handlePrimaryProviderChange('sitestripe')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <label htmlFor="sitestripe" className="ml-2 block text-sm text-gray-900">
                      SiteStripe Amazon Integration
                    </label>
                  </div>
                </div>
              </div>

              {/* Amazon PA-API Configuration */}
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Amazon PA-API Configuration</h3>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={config.providers.amazon_pa_api.enabled}
                        onChange={(e) => handleProviderToggle('amazon_pa_api', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Enabled</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => testProvider('amazon_pa_api')}
                      disabled={loading}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Test
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="amazon_access_key" className="block text-sm font-medium text-gray-700">
                      Access Key
                    </label>
                    <input
                      type="text"
                      id="amazon_access_key"
                      value={config.providers.amazon_pa_api.config.accessKey}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        providers: {
                          ...prev.providers,
                          amazon_pa_api: {
                            ...prev.providers.amazon_pa_api,
                            config: {
                              ...prev.providers.amazon_pa_api.config,
                              accessKey: e.target.value
                            }
                          }
                        }
                      }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                    />
                  </div>

                  <div>
                    <label htmlFor="amazon_secret_key" className="block text-sm font-medium text-gray-700">
                      Secret Key
                    </label>
                    <input
                      type="password"
                      id="amazon_secret_key"
                      value={config.providers.amazon_pa_api.config.secretKey}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        providers: {
                          ...prev.providers,
                          amazon_pa_api: {
                            ...prev.providers.amazon_pa_api,
                            config: {
                              ...prev.providers.amazon_pa_api.config,
                              secretKey: e.target.value
                            }
                          }
                        }
                      }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                    />
                  </div>

                  <div>
                    <label htmlFor="amazon_partner_tag" className="block text-sm font-medium text-gray-700">
                      Partner Tag
                    </label>
                    <input
                      type="text"
                      id="amazon_partner_tag"
                      value={config.providers.amazon_pa_api.config.partnerTag}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        providers: {
                          ...prev.providers,
                          amazon_pa_api: {
                            ...prev.providers.amazon_pa_api,
                            config: {
                              ...prev.providers.amazon_pa_api.config,
                              partnerTag: e.target.value
                            }
                          }
                        }
                      }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="choreblimey-20"
                    />
                  </div>

                  <div>
                    <label htmlFor="amazon_region" className="block text-sm font-medium text-gray-700">
                      Region
                    </label>
                    <select
                      id="amazon_region"
                      value={config.providers.amazon_pa_api.config.region}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        providers: {
                          ...prev.providers,
                          amazon_pa_api: {
                            ...prev.providers.amazon_pa_api,
                            config: {
                              ...prev.providers.amazon_pa_api.config,
                              region: e.target.value
                            }
                          }
                        }
                      }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="us-east-1">US East (N. Virginia)</option>
                      <option value="us-west-2">US West (Oregon)</option>
                      <option value="eu-west-1">Europe (Ireland)</option>
                      <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SiteStripe Configuration */}
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">SiteStripe Configuration</h3>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={config.providers.sitestripe.enabled}
                        onChange={(e) => handleProviderToggle('sitestripe', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Enabled</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => testProvider('sitestripe')}
                      disabled={loading}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Test
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="sitestripe_api_key" className="block text-sm font-medium text-gray-700">
                      API Key
                    </label>
                    <input
                      type="text"
                      id="sitestripe_api_key"
                      value={config.providers.sitestripe.config.apiKey}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        providers: {
                          ...prev.providers,
                          sitestripe: {
                            ...prev.providers.sitestripe,
                            config: {
                              ...prev.providers.sitestripe.config,
                              apiKey: e.target.value
                            }
                          }
                        }
                      }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="sk_live_..."
                    />
                  </div>

                  <div>
                    <label htmlFor="sitestripe_secret_key" className="block text-sm font-medium text-gray-700">
                      Secret Key
                    </label>
                    <input
                      type="password"
                      id="sitestripe_secret_key"
                      value={config.providers.sitestripe.config.secretKey}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        providers: {
                          ...prev.providers,
                          sitestripe: {
                            ...prev.providers.sitestripe,
                            config: {
                              ...prev.providers.sitestripe.config,
                              secretKey: e.target.value
                            }
                          }
                        }
                      }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="sk_live_..."
                    />
                  </div>

                  <div>
                    <label htmlFor="sitestripe_affiliate_id" className="block text-sm font-medium text-gray-700">
                      Affiliate ID
                    </label>
                    <input
                      type="text"
                      id="sitestripe_affiliate_id"
                      value={config.providers.sitestripe.config.affiliateId}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        providers: {
                          ...prev.providers,
                          sitestripe: {
                            ...prev.providers.sitestripe,
                            config: {
                              ...prev.providers.sitestripe.config,
                              affiliateId: e.target.value
                            }
                          }
                        }
                      }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="sitestripe-20"
                    />
                  </div>

                  <div>
                    <label htmlFor="sitestripe_region" className="block text-sm font-medium text-gray-700">
                      Region
                    </label>
                    <select
                      id="sitestripe_region"
                      value={config.providers.sitestripe.config.region}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        providers: {
                          ...prev.providers,
                          sitestripe: {
                            ...prev.providers.sitestripe,
                            config: {
                              ...prev.providers.sitestripe.config,
                              region: e.target.value
                            }
                          }
                        }
                      }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="us">United States</option>
                      <option value="uk">United Kingdom</option>
                      <option value="ca">Canada</option>
                      <option value="de">Germany</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Product Search Test */}
        <div className="mt-8 bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Test Product Search</h3>
            <p className="text-sm text-gray-600 mb-4">Test your affiliate provider configuration by searching for products with age and gender filters.</p>
            
            <ProductSearchTest />
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Configuration Help</h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p><strong>Amazon PA-API:</strong> Direct integration with Amazon's Product Advertising API. Requires Amazon Associates account and API credentials.</p>
            <p><strong>SiteStripe:</strong> Third-party Amazon affiliate management platform. May offer additional features like analytics and management tools.</p>
            <p><strong>Primary Provider:</strong> The provider used for product searches and reward generation. You can enable both providers for redundancy.</p>
            <p><strong>Age & Gender Tags:</strong> Use these filters to find age-appropriate and gender-specific products for your reward system.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
