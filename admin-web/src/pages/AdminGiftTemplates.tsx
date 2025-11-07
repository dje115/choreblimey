import React, { useState, useEffect } from 'react'
import { useAdminAuth } from '../contexts/AdminAuthContext'
import { adminApiClient } from '../lib/api'

interface GiftTemplate {
  id: string
  type: 'amazon_product' | 'activity' | 'custom'
  provider?: 'amazon_associates' | 'amazon_sitestripe' | null
  amazonAsin?: string | null
  affiliateUrl?: string | null
  affiliateTag?: string | null
  sitestripeUrl?: string | null
  title: string
  description?: string | null
  imageUrl?: string | null
  category?: string | null
  suggestedAgeRanges?: string[] | null
  suggestedGender?: 'male' | 'female' | 'both' | 'unisex' | null
  pricePence?: number | null
  suggestedStars: number
  active: boolean
  featured: boolean
  recurring: boolean
  redemptionCount?: number // Number of times this template has been redeemed
  createdAt: string
  updatedAt: string
}

const AdminGiftTemplates: React.FC = () => {
  const { adminLogout } = useAdminAuth()
  const [templates, setTemplates] = useState<GiftTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<GiftTemplate | null>(null)
  const [affiliateConfig, setAffiliateConfig] = useState<{ defaultStarValuePence: number; amazonTag?: string; sitestripeTag?: string }>({ defaultStarValuePence: 10 })
  const [amazonProductUrl, setAmazonProductUrl] = useState('')
  const [amazonProductLoading, setAmazonProductLoading] = useState(false)
  const [amazonProductError, setAmazonProductError] = useState<string | null>(null)
  const [amazonProductInfo, setAmazonProductInfo] = useState<any | null>(null)
  const [suggestedStarsError, setSuggestedStarsError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    type: '',
    category: '',
    active: '',
    featured: ''
  })
  const [sortConfig, setSortConfig] = useState<{
    key: 'title' | 'type' | 'suggestedStars' | 'active' | null
    direction: 'asc' | 'desc'
  }>({
    key: null,
    direction: 'asc'
  })

  // Form state
  const [formData, setFormData] = useState({
    type: 'activity' as 'amazon_product' | 'activity' | 'custom',
    provider: 'amazon_associates' as 'amazon_associates' | 'amazon_sitestripe' | '',
    amazonAsin: '',
    affiliateUrl: '',
    affiliateTag: '',
    sitestripeUrl: '',
    title: '',
    description: '',
    imageUrl: '',
    category: '',
    suggestedAgeRanges: [] as string[],
    suggestedGender: '' as 'male' | 'female' | 'both' | 'unisex' | '',
    pricePence: '',
    suggestedStars: '',
    active: true,
    featured: false,
    recurring: false
  })

  useEffect(() => {
    loadTemplates()
  }, [filters])

  useEffect(() => {
    const loadAffiliateConfig = async () => {
      try {
        const response = await adminApiClient.getAffiliateConfig()
        const cfg = response?.config
        if (cfg) {
          setAffiliateConfig({
            defaultStarValuePence: cfg.defaultStarValuePence ?? 10,
            amazonTag: cfg.amazonTag ?? '',
            sitestripeTag: cfg.sitestripeTag ?? ''
          })
        }
      } catch (error) {
        console.error('Failed to load affiliate configuration:', error)
      }
    }

    loadAffiliateConfig()
  }, [])

  useEffect(() => {
    if (formData.type !== 'amazon_product') {
      setAmazonProductUrl('')
      setAmazonProductInfo(null)
      setAmazonProductError(null)
    }
  }, [formData.type])

  useEffect(() => {
    if (formData.type === 'amazon_product' && !formData.affiliateTag) {
      const defaultTag = affiliateConfig.sitestripeTag || affiliateConfig.amazonTag || ''
      if (defaultTag) {
        setFormData((prev) => {
          if (prev.affiliateTag) return prev
          return { ...prev, affiliateTag: defaultTag }
        })
      }
    }
  }, [formData.type, formData.affiliateTag, affiliateConfig.sitestripeTag, affiliateConfig.amazonTag])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (filters.type) params.type = filters.type
      if (filters.category) params.category = filters.category
      if (filters.active) params.active = filters.active
      if (filters.featured) params.featured = filters.featured

      const response = await adminApiClient.listGiftTemplates(params)
      setTemplates(response.templates || [])
    } catch (error) {
      console.error('Failed to load gift templates:', error)
      alert('Failed to load gift templates: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      setSuggestedStarsError(null)
      if (!formData.title || !formData.suggestedStars) {
        if (!formData.title) {
          alert('Title is required')
        }
        if (!formData.suggestedStars) {
          setSuggestedStarsError('Please enter the number of stars required.')
        }
        return
      }

      const parsedStars = parseInt(formData.suggestedStars, 10)
      if (isNaN(parsedStars) || parsedStars <= 0) {
        setSuggestedStarsError('Please enter the number of stars required.')
        return
      }

      const data: any = {
        type: formData.type,
        title: formData.title,
        suggestedStars: parsedStars,
        active: formData.active,
        featured: formData.featured,
        recurring: formData.recurring
      }

      if (formData.type === 'amazon_product') {
        data.provider = formData.provider
        if (formData.amazonAsin) data.amazonAsin = formData.amazonAsin
        if (formData.affiliateUrl) data.affiliateUrl = formData.affiliateUrl
        if (formData.affiliateTag) data.affiliateTag = formData.affiliateTag
        if (formData.sitestripeUrl) data.sitestripeUrl = formData.sitestripeUrl
        if (formData.pricePence) {
          const parsedPrice = parseInt(formData.pricePence, 10)
          if (!isNaN(parsedPrice) && parsedPrice >= 0) {
            data.pricePence = parsedPrice
          }
        }
      }

      if (formData.description) data.description = formData.description
      if (formData.imageUrl) data.imageUrl = formData.imageUrl
      if (formData.category) data.category = formData.category
      if (formData.suggestedAgeRanges.length > 0) data.suggestedAgeRanges = formData.suggestedAgeRanges
      if (formData.suggestedGender) data.suggestedGender = formData.suggestedGender

      if (editingTemplate) {
        await adminApiClient.updateGiftTemplate(editingTemplate.id, data)
      } else {
        await adminApiClient.createGiftTemplate(data)
      }

      setShowCreateModal(false)
      setEditingTemplate(null)
      resetForm()
      loadTemplates()
    } catch (error) {
      alert('Failed to save gift template: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleFetchAmazonProduct = async () => {
    if (!amazonProductUrl.trim()) {
      setAmazonProductError('Enter a valid Amazon product URL')
      return
    }

    try {
      setAmazonProductLoading(true)
      setAmazonProductError(null)
      const result = await adminApiClient.resolveAmazonProduct(amazonProductUrl.trim())
      const product = result?.product

      if (!product) {
        setAmazonProductError('Could not find product information')
        setAmazonProductInfo(null)
        return
      }

      setAmazonProductInfo(product)
      setSuggestedStarsError(null)

      const defaultAffiliateTag = affiliateConfig.sitestripeTag || affiliateConfig.amazonTag || ''
      const recognizedAgeRanges = ['5-8', '9-11', '12-15', '16+']

      setFormData((prev) => {
        const updated = { ...prev }

        if (product.asin) {
          updated.amazonAsin = product.asin
        }
        if (product.affiliateLink) {
          updated.affiliateUrl = product.affiliateLink
        }
        if (!updated.affiliateTag && defaultAffiliateTag) {
          updated.affiliateTag = defaultAffiliateTag
        }
        if (product.title) {
          updated.title = product.title
        }
        if (product.shortDescription) {
          updated.description = product.shortDescription
        }
        if (product.image) {
          updated.imageUrl = product.image
        }
        if (product.category) {
          updated.category = product.category
        }
        if (product.pricePence) {
          updated.pricePence = String(product.pricePence)
        }
        if (product.suggestedAgeRanges?.length) {
          const validRanges = product.suggestedAgeRanges.filter((range) => recognizedAgeRanges.includes(range))
          if (validRanges.length) {
            updated.suggestedAgeRanges = validRanges
          }
        }
        if (product.suggestedGender && ['male', 'female', 'both', 'unisex'].includes(product.suggestedGender)) {
          updated.suggestedGender = product.suggestedGender as any
        }

        if (typeof product.suggestedStars === 'number' && product.suggestedStars > 0) {
          updated.suggestedStars = String(product.suggestedStars)
        } else if (product.pricePence) {
          const defaultStarValue = affiliateConfig.defaultStarValuePence > 0 ? affiliateConfig.defaultStarValuePence : 10
          updated.suggestedStars = String(Math.max(1, Math.round(product.pricePence / defaultStarValue)))
        }

        return updated
      })
    } catch (error: any) {
      setAmazonProductInfo(null)
      setAmazonProductError(error?.message || 'Failed to fetch product details')
    } finally {
      setAmazonProductLoading(false)
    }
  }

  const handleEdit = (template: GiftTemplate) => {
    setEditingTemplate(template)
    setFormData({
      type: template.type,
      provider: template.provider || 'amazon_associates',
      amazonAsin: template.amazonAsin || '',
      affiliateUrl: template.affiliateUrl || '',
      affiliateTag: template.affiliateTag || '',
      sitestripeUrl: template.sitestripeUrl || '',
      title: template.title,
      description: template.description || '',
      imageUrl: template.imageUrl || '',
      category: template.category || '',
      suggestedAgeRanges: template.suggestedAgeRanges || [],
      suggestedGender: template.suggestedGender || '',
      pricePence: template.pricePence ? template.pricePence.toString() : '',
      suggestedStars: template.suggestedStars.toString(),
      active: template.active,
      featured: template.featured,
      recurring: template.recurring
    })
    if (template.type === 'amazon_product') {
      const canonicalUrl = template.affiliateUrl || (template.amazonAsin ? `https://www.amazon.co.uk/dp/${template.amazonAsin}` : '')
      setAmazonProductUrl(canonicalUrl || '')
      setAmazonProductInfo({
        title: template.title,
        shortDescription: template.description,
        image: template.imageUrl,
        pricePence: template.pricePence ?? undefined,
        affiliateLink: template.affiliateUrl ?? '',
        asin: template.amazonAsin ?? '',
        suggestedStars: template.suggestedStars,
        category: template.category ?? null
      })
    } else {
      setAmazonProductUrl('')
      setAmazonProductInfo(null)
    }
    setAmazonProductError(null)
    setSuggestedStarsError(null)
    setShowCreateModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this gift template?')) return

    try {
      await adminApiClient.deleteGiftTemplate(id)
      loadTemplates()
    } catch (error) {
      alert('Failed to delete gift template: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleToggleActive = async (template: GiftTemplate) => {
    try {
      await adminApiClient.updateGiftTemplate(template.id, {
        active: !template.active
      })
      // Update local state immediately for better UX
      setTemplates(templates.map(t => 
        t.id === template.id ? { ...t, active: !t.active } : t
      ))
    } catch (error) {
      alert('Failed to update gift template status: ' + (error instanceof Error ? error.message : 'Unknown error'))
      // Reload templates on error to revert UI
      loadTemplates()
    }
  }

  const handleToggleRecurring = async (template: GiftTemplate) => {
    try {
      await adminApiClient.updateGiftTemplate(template.id, {
        recurring: !template.recurring
      })
      // Update local state immediately for better UX
      setTemplates(templates.map(t => 
        t.id === template.id ? { ...t, recurring: !t.recurring } : t
      ))
    } catch (error) {
      alert('Failed to update recurring status: ' + (error instanceof Error ? error.message : 'Unknown error'))
      // Reload templates on error to revert UI
      loadTemplates()
    }
  }

  const handleGenerateAffiliateUrl = async () => {
    if (!formData.amazonAsin || !formData.affiliateTag) {
      alert('ASIN and affiliate tag are required to generate URL')
      return
    }

    try {
      const response = await adminApiClient.generateAffiliateUrl(formData.amazonAsin, formData.affiliateTag)
      setFormData({ ...formData, affiliateUrl: response.affiliateUrl })
    } catch (error) {
      alert('Failed to generate affiliate URL: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const resetForm = () => {
    setFormData({
      type: 'activity',
      provider: 'amazon_associates',
      amazonAsin: '',
      affiliateUrl: '',
      affiliateTag: '',
      sitestripeUrl: '',
      title: '',
      description: '',
      imageUrl: '',
      category: '',
      suggestedAgeRanges: [],
      suggestedGender: '',
      pricePence: '',
      suggestedStars: '',
      active: true,
      featured: false,
      recurring: false
    })
    setAmazonProductUrl('')
    setAmazonProductInfo(null)
    setAmazonProductError(null)
    setSuggestedStarsError(null)
  }

  const toggleAgeRange = (range: string) => {
    const ranges = formData.suggestedAgeRanges
    if (ranges.includes(range)) {
      setFormData({ ...formData, suggestedAgeRanges: ranges.filter(r => r !== range) })
    } else {
      setFormData({ ...formData, suggestedAgeRanges: [...ranges, range] })
    }
  }

  const handleLogout = async () => {
    await adminLogout()
  }

  const handleSort = (key: 'title' | 'type' | 'suggestedStars' | 'active') => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    })
  }

  const getSortedTemplates = () => {
    if (!sortConfig.key) return templates

    const sorted = [...templates].sort((a, b) => {
      let aValue: any = a[sortConfig.key!]
      let bValue: any = b[sortConfig.key!]

      // Handle string comparison (title, type)
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      // Handle boolean comparison (active)
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        aValue = aValue ? 1 : 0
        bValue = bValue ? 1 : 0
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })

    return sorted
  }

  const getSortIcon = (columnKey: 'title' | 'type' | 'suggestedStars' | 'active') => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-gray-400">↕️</span>
    }
    return sortConfig.direction === 'asc' ? <span>↑</span> : <span>↓</span>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading gift templates...</p>
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
                  Gift Templates
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
        {/* Filters and Actions */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Types</option>
                <option value="amazon_product">Amazon Product</option>
                <option value="activity">Activity</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                placeholder="Category"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.active}
                onChange={(e) => setFilters({ ...filters, active: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Featured</label>
              <select
                value={filters.featured}
                onChange={(e) => setFilters({ ...filters, featured: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All</option>
                <option value="true">Featured</option>
                <option value="false">Not Featured</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => {
              resetForm()
              setEditingTemplate(null)
              setShowCreateModal(true)
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            + Create Gift Template
          </button>
        </div>

        {/* Templates List */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-2">
                    Title
                    {getSortIcon('title')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center gap-2">
                    Type
                    {getSortIcon('type')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('suggestedStars')}
                >
                  <div className="flex items-center gap-2">
                    Stars
                    {getSortIcon('suggestedStars')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('active')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    {getSortIcon('active')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Redemptions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getSortedTemplates().map((template) => (
                <tr key={template.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {template.imageUrl ? (
                      <img src={template.imageUrl} alt={template.title} className="h-16 w-16 object-cover rounded" />
                    ) : (
                      <div className="h-16 w-16 bg-gray-200 rounded flex items-center justify-center">
                        <span className="text-gray-400">No Image</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{template.title}</div>
                    {template.description && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">{template.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {template.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {template.suggestedStars} ⭐
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={template.active}
                          onChange={() => handleToggleActive(template)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                          title={template.active ? "Disable to hide from users" : "Enable to show to users"}
                        />
                        <span className="ml-2 text-sm text-gray-700 whitespace-nowrap">
                          Visible
                        </span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={template.recurring || false}
                          onChange={() => handleToggleRecurring(template)}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer"
                          title={template.recurring ? "Disable recurring (one-time purchase only)" : "Enable recurring (can be purchased multiple times)"}
                        />
                        <span className="ml-2 text-sm text-gray-700 whitespace-nowrap">
                          Recurring
                        </span>
                      </label>
                      {template.featured && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 w-fit">
                          Featured
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{template.redemptionCount || 0}</span>
                      <span className="text-xs text-gray-500">purchases</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(template)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingTemplate ? 'Edit Gift Template' : 'Create Gift Template'}
              </h3>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="amazon_product">Amazon Product</option>
                    <option value="activity">Activity</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {/* Amazon Product Fields */}
                {formData.type === 'amazon_product' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amazon Product URL *</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="url"
                          value={amazonProductUrl}
                          onChange={(e) => {
                            setAmazonProductUrl(e.target.value)
                            setAmazonProductError(null)
                          }}
                          placeholder="https://www.amazon.co.uk/your-product"
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          required
                        />
                        <button
                          onClick={handleFetchAmazonProduct}
                          type="button"
                          disabled={amazonProductLoading}
                          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60"
                        >
                          {amazonProductLoading ? 'Fetching…' : 'Fetch Details'}
                        </button>
                      </div>
                      {amazonProductError && (
                        <p className="mt-2 text-sm text-red-600">{amazonProductError}</p>
                      )}
                      {amazonProductInfo && (
                        <div className="mt-3 p-3 border border-blue-200 rounded-md bg-blue-50">
                          <div className="flex gap-3">
                            {amazonProductInfo.image && (
                              <img
                                src={amazonProductInfo.image}
                                alt={amazonProductInfo.title}
                                className="w-16 h-16 object-cover rounded"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-blue-900 truncate">{amazonProductInfo.title}</h4>
                              {amazonProductInfo.shortDescription && (
                                <p className="text-xs text-blue-800 truncate">{amazonProductInfo.shortDescription}</p>
                              )}
                              <div className="text-xs text-blue-700 mt-1 flex flex-wrap gap-2">
                                {amazonProductInfo.pricePence ? (
                                  <span>Price: £{(amazonProductInfo.pricePence / 100).toFixed(2)}</span>
                                ) : amazonProductInfo.price && amazonProductInfo.currency === 'GBP' ? (
                                  <span>Price: £{amazonProductInfo.price.toFixed(2)}</span>
                                ) : null}
                                {amazonProductInfo.asin && <span>ASIN: {amazonProductInfo.asin}</span>}
                                {amazonProductInfo.category && <span>Category: {amazonProductInfo.category}</span>}
                              </div>
                            </div>
                          </div>
                          {typeof amazonProductInfo.suggestedStars === 'number' && (
                            <p className="mt-2 text-xs text-blue-700">Suggested stars: {amazonProductInfo.suggestedStars}</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Provider *</label>
                      <select
                        value={formData.provider}
                        onChange={(e) => setFormData({ ...formData, provider: e.target.value as any })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="amazon_associates">Amazon Associates</option>
                        <option value="amazon_sitestripe">Amazon SiteStripe</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ASIN</label>
                      <input
                        type="text"
                        value={formData.amazonAsin}
                        onChange={(e) => setFormData({ ...formData, amazonAsin: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    {formData.provider === 'amazon_associates' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Affiliate Tag</label>
                          <input
                            type="text"
                            value={formData.affiliateTag}
                            onChange={(e) => setFormData({ ...formData, affiliateTag: e.target.value })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                          />
                        </div>
                        <button
                          onClick={handleGenerateAffiliateUrl}
                          className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                        >
                          Generate Affiliate URL
                        </button>
                      </>
                    )}
                    {formData.provider === 'amazon_sitestripe' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SiteStripe URL</label>
                        <input
                          type="text"
                          value={formData.sitestripeUrl}
                          onChange={(e) => setFormData({ ...formData, sitestripeUrl: e.target.value })}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Affiliate URL</label>
                      <input
                        type="text"
                        value={formData.affiliateUrl}
                        onChange={(e) => setFormData({ ...formData, affiliateUrl: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price (pence)</label>
                      <input
                        type="number"
                        value={formData.pricePence}
                        onChange={(e) => setFormData({ ...formData, pricePence: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </>
                )}

                {/* Common Fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Upload Image File</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            try {
                              const result = await adminApiClient.uploadImage(file)
                              setFormData({ ...formData, imageUrl: result.imageUrl })
                              alert('Image uploaded successfully!')
                            } catch (error) {
                              alert('Failed to upload image: ' + (error instanceof Error ? error.message : 'Unknown error'))
                            }
                          }
                        }}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="text-xs text-gray-500 text-center">or</div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Image URL (will be downloaded and stored)</label>
                      <input
                        type="text"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        placeholder="https://example.com/image.jpg"
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                  {formData.imageUrl && (
                    <div className="mt-2">
                      <img 
                        src={formData.imageUrl} 
                        alt="Preview" 
                        className="h-32 w-32 object-cover rounded border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Suggested Age Ranges</label>
                  <div className="flex flex-wrap gap-2">
                    {['5-8', '9-11', '12-15', '16+'].map((range) => (
                      <label key={range} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.suggestedAgeRanges.includes(range)}
                          onChange={() => toggleAgeRange(range)}
                          className="mr-2"
                        />
                        {range}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Suggested Gender</label>
                  <select
                    value={formData.suggestedGender}
                    onChange={(e) => setFormData({ ...formData, suggestedGender: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Not Specified</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="both">Both</option>
                    <option value="unisex">Unisex</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Suggested Stars *</label>
                  <input
                    type="number"
                    value={formData.suggestedStars}
                    onChange={(e) => {
                      setFormData({ ...formData, suggestedStars: e.target.value })
                      setSuggestedStarsError(null)
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                  {suggestedStarsError && (
                    <p className="mt-1 text-xs text-red-600 font-medium">{suggestedStarsError}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="mr-2"
                    />
                    Active
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                      className="mr-2"
                    />
                    Featured
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.recurring}
                      onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                      className="mr-2"
                    />
                    Recurring (can be purchased multiple times)
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingTemplate(null)
                    resetForm()
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingTemplate ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminGiftTemplates
