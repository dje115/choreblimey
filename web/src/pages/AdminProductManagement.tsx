import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface Product {
  id: string
  title: string
  description?: string
  imageUrl?: string
  affiliateUrl: string
  pricePence?: number
  ageTag: string
  genderTag: string
  category?: string
  interestTags?: string[]
  starsRequired?: number
  featured: boolean
  blocked: boolean
  popularityScore: number
  createdAt: string
  updatedAt: string
}

interface ProductFormData {
  title: string
  description: string
  imageUrl: string
  affiliateUrl: string
  pricePence: string
  ageTag: string
  genderTag: string
  category: string
  interestTags: string
  starsRequired: string
  featured: boolean
}

export default function AdminProductManagement() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState<ProductFormData>({
    title: '',
    description: '',
    imageUrl: '',
    affiliateUrl: '',
    pricePence: '',
    ageTag: 'all_ages',
    genderTag: 'both',
    category: '',
    interestTags: '',
    starsRequired: '',
    featured: false
  })

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      const response = await fetch('http://localhost:1501/v1/admin/products')
      const data = await response.json()
      setProducts(data.products || [])
    } catch (err) {
      setError('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const productData = {
        ...formData,
        pricePence: formData.pricePence ? parseInt(formData.pricePence) : undefined,
        starsRequired: formData.starsRequired ? parseInt(formData.starsRequired) : undefined,
        interestTags: formData.interestTags ? formData.interestTags.split(',').map(tag => tag.trim()) : undefined
      }

      const url = editingProduct 
        ? `http://localhost:1501/v1/admin/products/${editingProduct.id}`
        : 'http://localhost:1501/v1/admin/products'
      
      const method = editingProduct ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      })

      if (response.ok) {
        setShowAddForm(false)
        setEditingProduct(null)
        resetForm()
        loadProducts()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save product')
      }
    } catch (err) {
      setError('Failed to save product')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      imageUrl: '',
      affiliateUrl: '',
      pricePence: '',
      ageTag: 'all_ages',
      genderTag: 'both',
      category: '',
      interestTags: '',
      starsRequired: '',
      featured: false
    })
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      title: product.title,
      description: product.description || '',
      imageUrl: product.imageUrl || '',
      affiliateUrl: product.affiliateUrl,
      pricePence: product.pricePence?.toString() || '',
      ageTag: product.ageTag,
      genderTag: product.genderTag,
      category: product.category || '',
      interestTags: product.interestTags?.join(', ') || '',
      starsRequired: product.starsRequired?.toString() || '',
      featured: product.featured
    })
    setShowAddForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const response = await fetch(`http://localhost:1501/v1/admin/products/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadProducts()
      } else {
        setError('Failed to delete product')
      }
    } catch (err) {
      setError('Failed to delete product')
    }
  }

  const toggleFeatured = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:1501/v1/admin/products/${id}/toggle-featured`, {
        method: 'POST'
      })

      if (response.ok) {
        loadProducts()
      }
    } catch (err) {
      setError('Failed to toggle featured status')
    }
  }

  const toggleBlocked = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:1501/v1/admin/products/${id}/toggle-blocked`, {
        method: 'POST'
      })

      if (response.ok) {
        loadProducts()
      }
    } catch (err) {
      setError('Failed to toggle blocked status')
    }
  }

  const formatPrice = (pricePence?: number) => {
    if (!pricePence) return 'Price not set'
    return `£${(pricePence / 100).toFixed(2)}`
  }

  if (loading && products.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Product Management</h1>
            <p className="mt-2 text-gray-600">Manage reward products for ChoreBlimey</p>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => navigate('/admin')}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => {
                resetForm()
                setEditingProduct(null)
                setShowAddForm(true)
              }}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Add Product
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Add/Edit Product Form */}
        {showAddForm && (
          <div className="mb-8 bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      Product Title *
                    </label>
                    <input
                      type="text"
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="affiliateUrl" className="block text-sm font-medium text-gray-700">
                      Affiliate URL *
                    </label>
                    <input
                      type="url"
                      id="affiliateUrl"
                      value={formData.affiliateUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, affiliateUrl: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="https://amazon.com/dp/..."
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700">
                      Image URL
                    </label>
                    <input
                      type="url"
                      id="imageUrl"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="https://m.media-amazon.com/images/..."
                    />
                  </div>

                  <div>
                    <label htmlFor="pricePence" className="block text-sm font-medium text-gray-700">
                      Price (pence)
                    </label>
                    <input
                      type="number"
                      id="pricePence"
                      value={formData.pricePence}
                      onChange={(e) => setFormData(prev => ({ ...prev, pricePence: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="2999 (for £29.99)"
                    />
                  </div>

                  <div>
                    <label htmlFor="ageTag" className="block text-sm font-medium text-gray-700">
                      Age Group *
                    </label>
                    <select
                      id="ageTag"
                      value={formData.ageTag}
                      onChange={(e) => setFormData(prev => ({ ...prev, ageTag: e.target.value }))}
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
                    <label htmlFor="genderTag" className="block text-sm font-medium text-gray-700">
                      Gender *
                    </label>
                    <select
                      id="genderTag"
                      value={formData.genderTag}
                      onChange={(e) => setFormData(prev => ({ ...prev, genderTag: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="both">Both</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="unisex">Unisex</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                      Category
                    </label>
                    <input
                      type="text"
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="toys, books, electronics"
                    />
                  </div>

                  <div>
                    <label htmlFor="starsRequired" className="block text-sm font-medium text-gray-700">
                      Stars Required
                    </label>
                    <input
                      type="number"
                      id="starsRequired"
                      value={formData.starsRequired}
                      onChange={(e) => setFormData(prev => ({ ...prev, starsRequired: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="10"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Product description..."
                  />
                </div>

                <div>
                  <label htmlFor="interestTags" className="block text-sm font-medium text-gray-700">
                    Interest Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    id="interestTags"
                    value={formData.interestTags}
                    onChange={(e) => setFormData(prev => ({ ...prev, interestTags: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="pets, reading, music, sports"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="featured"
                    checked={formData.featured}
                    onChange={(e) => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="featured" className="ml-2 block text-sm text-gray-900">
                    Featured Product
                  </label>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false)
                      setEditingProduct(null)
                      resetForm()
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Products List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Products ({products.length})</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Manage your reward products</p>
          </div>
          
          {products.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No products</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by adding your first product.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {products.map((product) => (
                <li key={product.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="h-16 w-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-medium text-gray-900 truncate">{product.title}</h4>
                          {product.featured && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Featured
                            </span>
                          )}
                          {product.blocked && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Blocked
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{product.description}</p>
                        <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                          <span>{formatPrice(product.pricePence)}</span>
                          <span>{product.ageTag.replace('_', ' ')}</span>
                          <span>{product.genderTag}</span>
                          {product.category && <span>{product.category}</span>}
                          <span>{product.starsRequired} stars</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleFeatured(product.id)}
                        className={`px-2 py-1 text-xs rounded ${
                          product.featured 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {product.featured ? 'Featured' : 'Feature'}
                      </button>
                      <button
                        onClick={() => toggleBlocked(product.id)}
                        className={`px-2 py-1 text-xs rounded ${
                          product.blocked 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {product.blocked ? 'Unblock' : 'Block'}
                      </button>
                      <button
                        onClick={() => handleEdit(product)}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

