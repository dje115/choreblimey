import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { apiClient } from '../../../lib/api'
import { notifyUpdate } from '../../../utils/notifications'

type GiftType = 'activity' | 'custom' | 'amazon_product'

type ChildOption = {
  id: string
  nickname: string
}

interface CreateFamilyGiftModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => Promise<void> | void
  children: ChildOption[]
}

interface AmazonProductInfo {
  title?: string
  shortDescription?: string
  description?: string
  image?: string
  asin?: string
  affiliateUrl?: string
  price?: number
  pricePence?: number
  currency?: string
}

const CreateFamilyGiftModal: React.FC<CreateFamilyGiftModalProps> = ({ isOpen, onClose, onCreated, children }) => {
  const [type, setType] = useState<GiftType>('activity')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [starsRequired, setStarsRequired] = useState<string>('10')
  const [availableForAll, setAvailableForAll] = useState(true)
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([])
  const [recurring, setRecurring] = useState(true)
  const [imageUrl, setImageUrl] = useState('')
  const [affiliateUrl, setAffiliateUrl] = useState('')
  const [amazonUrl, setAmazonUrl] = useState('')
  const [amazonInfo, setAmazonInfo] = useState<AmazonProductInfo | null>(null)
  const [amazonLoading, setAmazonLoading] = useState(false)
  const [amazonError, setAmazonError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setType('activity')
      setTitle('')
      setDescription('')
      setStarsRequired('10')
      setAvailableForAll(true)
      setSelectedChildIds([])
      setRecurring(true)
      setImageUrl('')
      setAffiliateUrl('')
      setAmazonUrl('')
      setAmazonInfo(null)
      setAmazonLoading(false)
      setAmazonError(null)
      setFormError(null)
      setFormSuccess(null)
    }
  }, [isOpen])

  const numericStarsRequired = useMemo(() => {
    const parsed = parseInt(starsRequired, 10)
    return Number.isNaN(parsed) ? 0 : parsed
  }, [starsRequired])

  const toggleChildSelection = useCallback(
    (childId: string) => {
      setSelectedChildIds((previous) =>
        previous.includes(childId)
          ? previous.filter((id) => id !== childId)
          : [...previous, childId],
      )
    },
    [],
  )

  const handleFetchAmazonProduct = useCallback(async () => {
    const url = amazonUrl.trim()
    if (!url) {
      setAmazonError('Enter a valid Amazon product URL')
      return
    }

    try {
      setAmazonLoading(true)
      setAmazonError(null)
      setFormError(null)
      const response = await apiClient.resolveAmazonProduct(url)
      const product: AmazonProductInfo | undefined = response?.product

      if (!product) {
        setAmazonInfo(null)
        setAmazonError('Could not find product information')
        return
      }

      setAmazonInfo(product)
      if (!title) {
        setTitle(product.title || 'Amazon Gift')
      }
      if (!description && (product.shortDescription || product.description)) {
        setDescription(product.shortDescription || product.description || '')
      }
      if (!imageUrl && product.image) {
        setImageUrl(product.image)
      }
      if (!affiliateUrl && product.affiliateUrl) {
        setAffiliateUrl(product.affiliateUrl)
      }
      if ((!starsRequired || starsRequired === '0') && product.price) {
        const approxStars = Math.max(1, Math.round(product.price))
        setStarsRequired(String(approxStars))
      }
    } catch (error: any) {
      console.error('Failed to resolve Amazon product', error)
      setAmazonInfo(null)
      setAmazonError(error?.message || 'Failed to fetch product details')
    } finally {
      setAmazonLoading(false)
    }
  }, [amazonUrl, title, description, imageUrl, affiliateUrl, starsRequired])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setFormError(null)
      setFormSuccess(null)

      if (!numericStarsRequired || numericStarsRequired < 1) {
        setFormError('Star cost must be at least 1')
        return
      }

      const payload: Record<string, unknown> = {
        type,
        title: title.trim() || (type === 'amazon_product' ? 'Amazon Gift' : 'Custom Gift'),
        description: description.trim() || undefined,
        starsRequired: numericStarsRequired,
        availableForAll,
        availableForChildIds: availableForAll ? [] : selectedChildIds,
        recurring,
      }

      const trimmedImageUrl = imageUrl.trim()
      if (trimmedImageUrl) {
        payload.imageUrl = trimmedImageUrl
      } else if (amazonInfo?.image) {
        payload.imageUrl = amazonInfo.image
      }

      const trimmedAffiliateUrl = affiliateUrl.trim()
      if (trimmedAffiliateUrl) {
        payload.affiliateUrl = trimmedAffiliateUrl
      } else if (amazonInfo?.affiliateUrl) {
        payload.affiliateUrl = amazonInfo.affiliateUrl
      }

      if (type === 'amazon_product') {
        if (!amazonInfo && !trimmedAffiliateUrl) {
          setFormError('Fetch product details or provide affiliate URL for Amazon gifts')
          return
        }
        if (amazonInfo?.asin) {
          payload.amazonAsin = amazonInfo.asin
        }
        if (amazonInfo?.pricePence) {
          payload.pricePence = amazonInfo.pricePence
        } else if (amazonInfo?.price) {
          payload.pricePence = Math.round(amazonInfo.price * 100)
        }
      }

      try {
        setSubmitting(true)
        await apiClient.createFamilyGift(payload)
        notifyUpdate('giftUpdated')
        setFormSuccess('Gift added to the family shop!')
        await onCreated()
        onClose()
      } catch (error: any) {
        console.error('Failed to create family gift', error)
        setFormError(error?.message || 'Failed to create gift. Please try again.')
      } finally {
        setSubmitting(false)
      }
    },
    [
      type,
      title,
      description,
      numericStarsRequired,
      availableForAll,
      selectedChildIds,
      recurring,
      imageUrl,
      affiliateUrl,
      amazonInfo,
      onCreated,
      onClose,
    ],
  )

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Family gift shop</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Add a new gift</h2>
            <p className="mt-2 text-sm text-slate-600">
              Create a reward children can redeem with their stars. Images can be hosted in MinIO
              (<code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-[11px]">http://localhost:1507</code> or
              <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-[11px]">http://192.168.22.181:1507</code>). Make sure
              the bucket/object is public or pre-signed for child devices.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
          >
            Close
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-300">
              <span className="text-sm font-semibold text-slate-700">Activity / Experience</span>
              <span className="text-xs text-slate-500">Create your own reward such as movie night or baking day.</span>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="radio"
                  name="gift-type"
                  value="activity"
                  checked={type === 'activity'}
                  onChange={() => setType('activity')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Activity</span>
              </div>
            </label>
            <label className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-300">
              <span className="text-sm font-semibold text-slate-700">Custom prize</span>
              <span className="text-xs text-slate-500">Use your own description, image, and link.</span>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="radio"
                  name="gift-type"
                  value="custom"
                  checked={type === 'custom'}
                  onChange={() => setType('custom')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Custom</span>
              </div>
            </label>
            <label className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-300 sm:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-slate-700">Amazon product</span>
                  <p className="text-xs text-slate-500">Paste an Amazon URL and we will pull the details + affiliate link.</p>
                </div>
                <input
                  type="radio"
                  name="gift-type"
                  value="amazon_product"
                  checked={type === 'amazon_product'}
                  onChange={() => setType('amazon_product')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
            </label>
          </div>

          {type === 'amazon_product' && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-4">
              <label className="block text-sm font-semibold text-indigo-700">Amazon product URL</label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  type="url"
                  value={amazonUrl}
                  onChange={(event) => setAmazonUrl(event.target.value)}
                  placeholder="https://www.amazon.co.uk/..."
                  className="flex-1 rounded-xl border border-indigo-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleFetchAmazonProduct}
                  disabled={amazonLoading}
                  className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
                >
                  {amazonLoading ? 'Fetching…' : 'Fetch details'}
                </button>
              </div>
              {amazonError && <p className="mt-2 text-xs font-semibold text-rose-600">{amazonError}</p>}
              {amazonInfo && (
                <p className="mt-2 text-xs text-indigo-700">
                  Pulled {amazonInfo.title ? `“${amazonInfo.title}”` : 'product details'} – adjust any fields below before saving.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Gift title *</label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Movie night with popcorn"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Stars required *</label>
              <input
                type="number"
                min={1}
                value={starsRequired}
                onChange={(event) => setStarsRequired(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                required
              />
              <p className="text-xs text-slate-500">Children must have at least this many stars to redeem.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Explain what’s included, delivery notes, etc."
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Image URL</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="http://localhost:1507/bucket/object.jpg"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
              />
              <p className="text-xs text-slate-500">
                Host images in MinIO or a public CDN. Ensure the URL is accessible to child devices on both localhost and
                192.168.22.181.
              </p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Affiliate or product link</label>
              <input
                type="url"
                value={affiliateUrl}
                onChange={(event) => setAffiliateUrl(event.target.value)}
                placeholder="https://amzn.to/..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
              />
              <p className="text-xs text-slate-500">
                Optional: include a tracking link for parents when fulfilling the reward.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 rounded-2xl border border-slate-200 px-4 py-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={availableForAll}
                onChange={(event) => setAvailableForAll(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-700">Available to all children</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(event) => setRecurring(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-700">Allow multiple redemptions</span>
            </label>
          </div>

          {!availableForAll && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-700">Select eligible children</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {children.length === 0 ? (
                  <p className="text-xs text-slate-500">Add children to the family to assign gifts.</p>
                ) : (
                  children.map((child) => (
                    <label
                      key={child.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600"
                    >
                      <input
                        type="checkbox"
                        checked={selectedChildIds.includes(child.id)}
                        onChange={() => toggleChildSelection(child.id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{child.nickname}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {formError && <p className="text-sm font-semibold text-rose-600">{formError}</p>}
          {formSuccess && <p className="text-sm font-semibold text-emerald-600">{formSuccess}</p>}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
            >
              {submitting ? 'Saving…' : 'Add gift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateFamilyGiftModal
