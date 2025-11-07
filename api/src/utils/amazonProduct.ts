import * as cheerio from 'cheerio'
import amazonPaapi from 'amazon-paapi'
import { AffiliateConfig, getAffiliateConfig, getTrackingTag } from './affiliateConfig.js'

interface ProductInfo {
  asin: string
  affiliateLink: string
  title?: string
  image?: string
  shortDescription?: string
  price?: number
  currency?: string
  source: 'paapi' | 'scrape'
}

interface ResolveOptions {
  url: string
}

const MARKET_MAP = {
  'amazon.co.uk': { marketplace: 'www.amazon.co.uk', defaultTagSuffix: '-21', region: 'eu-west-1' },
  'amazon.com': { marketplace: 'www.amazon.com', defaultTagSuffix: '-20', region: 'us-east-1' },
  'amazon.de': { marketplace: 'www.amazon.de', defaultTagSuffix: '-21', region: 'eu-west-1' },
  'amazon.fr': { marketplace: 'www.amazon.fr', defaultTagSuffix: '-21', region: 'eu-west-1' },
  'amazon.it': { marketplace: 'www.amazon.it', defaultTagSuffix: '-21', region: 'eu-west-1' },
  'amazon.es': { marketplace: 'www.amazon.es', defaultTagSuffix: '-21', region: 'eu-west-1' },
  'amazon.ca': { marketplace: 'www.amazon.ca', defaultTagSuffix: '-20', region: 'us-east-1' },
  'amazon.com.au': { marketplace: 'www.amazon.com.au', defaultTagSuffix: '-22', region: 'us-west-2' },
  'amazon.co.jp': { marketplace: 'www.amazon.co.jp', defaultTagSuffix: '-22', region: 'us-west-2' }
} as const

type MarketKey = keyof typeof MARKET_MAP

function normalizeHost(rawUrl: string): { host: MarketKey; url: URL } {
  const url = new URL(rawUrl)
  let host = url.hostname.replace(/^smile\./, '').replace(/^m\./, '')
  if (!Object.prototype.hasOwnProperty.call(MARKET_MAP, host)) {
    // default to UK marketplace
    host = 'amazon.co.uk'
  }
  return { host: host as MarketKey, url }
}

function extractASIN(url: URL): string | null {
  const path = url.pathname
  const patterns = [
    /\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i,
    /\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/i,
    /\/product\/([A-Z0-9]{10})(?:[/?]|$)/i
  ]
  for (const re of patterns) {
    const match = path.match(re)
    if (match) return match[1].toUpperCase()
  }
  for (const [key, value] of url.searchParams) {
    if (/^asin$/i.test(key) && /^[A-Z0-9]{10}$/i.test(value)) {
      return value.toUpperCase()
    }
  }
  return null
}

function buildAffiliateLink(host: MarketKey, asin: string, trackingTag: string | null): string {
  const market = MARKET_MAP[host]
  const tag = trackingTag || `choreblimey${market.defaultTagSuffix}`
  return `https://${market.marketplace}/dp/${asin}?tag=${encodeURIComponent(tag)}`
}

async function resolveViaPAAPI(host: MarketKey, asin: string, config: AffiliateConfig, trackingTag: string | null): Promise<ProductInfo | null> {
  if (!config.amazonEnabled || !config.amazonAccessKey || !config.amazonSecretKey) {
    return null
  }

  const market = MARKET_MAP[host]
  const tag = trackingTag || config.amazonTag || `choreblimey${market.defaultTagSuffix}`

  try {
    const result = await amazonPaapi.GetItems(
      {
        AccessKey: config.amazonAccessKey,
        SecretKey: config.amazonSecretKey,
        PartnerTag: tag,
        PartnerType: 'Associates',
        Marketplace: market.marketplace,
        Region: market.region,
        ItemIds: [asin],
        Resources: [
          'Images.Primary.Large',
          'Images.Primary.Medium',
          'ItemInfo.Title',
          'ItemInfo.Features',
          'ItemInfo.ContentInfo',
          'Offers.Listings.Price'
        ]
      },
      {} as any
    )

    const item = result?.ItemsResult?.Items?.[0]
    if (!item) return null

    const image =
      item.Images?.Primary?.Large?.URL ||
      item.Images?.Primary?.Medium?.URL ||
      undefined

    const title = item.ItemInfo?.Title?.DisplayValue

    let shortDescription: string | undefined
    const features = item.ItemInfo?.Features?.DisplayValues
    if (Array.isArray(features) && features.length) {
      shortDescription = String(features[0]).replace(/\s+/g, ' ').trim()
      if (shortDescription.length > 200) shortDescription = `${shortDescription.slice(0, 197)}...`
    }

    const price = item.Offers?.Listings?.[0]?.Price

    const affiliateLink = item.DetailPageURL || buildAffiliateLink(host, asin, tag)

    return {
      asin,
      affiliateLink,
      title,
      image,
      shortDescription,
      price: price?.Amount,
      currency: price?.Currency,
      source: 'paapi'
    }
  } catch (error) {
    console.error('PA-API lookup failed:', error)
    return null
  }
}

async function resolveViaScrape(host: MarketKey, asin: string, trackingTag: string | null): Promise<ProductInfo> {
  const cleanUrl = `https://${host}/dp/${asin}`
  let title: string | undefined
  let image: string | undefined
  let shortDescription: string | undefined

  try {
    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-GB,en;q=0.9'
      }
    })

    const html = await response.text()
    const $ = cheerio.load(html)

    title = $('#productTitle').text().trim() || $('meta[property="og:title"]').attr('content') || undefined

    image =
      $('meta[property="og:image"]').attr('content') ||
      $('#landingImage').attr('src') ||
      $('#imgTagWrapperId img').attr('data-old-hires') ||
      $('#imgTagWrapperId img').attr('src') ||
      undefined

    const bullets: string[] = []
    $('#feature-bullets ul li span.a-list-item').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (text) bullets.push(text)
    })
    if (bullets.length) {
      shortDescription = bullets[0]
      if (shortDescription.length > 200) shortDescription = `${shortDescription.slice(0, 197)}...`
    }
  } catch (error) {
    console.error('Amazon scrape failed:', error)
  }

  const affiliateLink = buildAffiliateLink(host, asin, trackingTag)

  return {
    asin,
    affiliateLink,
    title,
    image,
    shortDescription,
    source: 'scrape'
  }
}

export async function resolveAmazonProduct({ url }: ResolveOptions): Promise<ProductInfo> {
  const { host, url: parsed } = normalizeHost(url)
  const asin = extractASIN(parsed)
  if (!asin) {
    throw new Error('Unable to find ASIN in Amazon URL')
  }

  const config = await getAffiliateConfig()
  const trackingTag = getTrackingTag(config)

  const viaApi = await resolveViaPAAPI(host, asin, config, trackingTag)
  if (viaApi) {
    return viaApi
  }

  return resolveViaScrape(host, asin, trackingTag)
}

