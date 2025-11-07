import * as cheerio from 'cheerio'
import amazonPaapi from 'amazon-paapi'

interface AffiliateConfig {
  amazonEnabled: boolean
  amazonAssociateId: string | null
  amazonAccessKey: string | null
  amazonSecretKey: string | null
  amazonTag: string | null
  sitestripeTag: string | null
  defaultImageUrl: string | null
  defaultStarValuePence: number
}

type SuggestedGender = 'male' | 'female' | 'both' | 'unisex'

interface ProductInfo {
  asin: string
  affiliateLink: string
  title?: string
  image?: string
  shortDescription?: string
  price?: number
  currency?: string
  pricePence?: number
  source: 'paapi' | 'scrape'
  category?: string
  suggestedAgeRanges?: string[]
  suggestedGender?: SuggestedGender | null
}

interface ResolveOptions {
  url: string
  config: AffiliateConfig
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

const AGE_BUCKETS = [
  { label: '5-8', min: 5, max: 8 },
  { label: '9-11', min: 9, max: 11 },
  { label: '12-15', min: 12, max: 15 },
  { label: '16+', min: 16, max: 99 }
]

function addAgeRangeForValue(ranges: Set<string>, value: number) {
  for (const bucket of AGE_BUCKETS) {
    if (value >= bucket.min && value <= bucket.max) {
      ranges.add(bucket.label)
      return
    }
  }

  if (value >= AGE_BUCKETS[AGE_BUCKETS.length - 1].min) {
    ranges.add('16+')
  }
}

function inferAgeRanges(texts: string[]): string[] {
  const ranges = new Set<string>()

  for (const raw of texts) {
    if (!raw) continue
    const text = raw.toLowerCase()

    const rangeMatch = text.match(/(ages?|for ages|age range|age group)[^0-9]{0,10}(\d{1,2})\s*(?:-|to|–)\s*(\d{1,2})/)
    if (rangeMatch) {
      const start = parseInt(rangeMatch[2], 10)
      const end = parseInt(rangeMatch[3], 10)
      if (!isNaN(start) && !isNaN(end)) {
        for (let val = start; val <= end; val++) {
          addAgeRangeForValue(ranges, val)
        }
        continue
      }
    }

    const plusMatch = text.match(/(ages?|age)[^0-9]{0,5}(\d{1,2})\s*(?:\+|plus|and up)/)
    if (plusMatch) {
      const value = parseInt(plusMatch[2], 10)
      if (!isNaN(value)) {
        addAgeRangeForValue(ranges, value)
        addAgeRangeForValue(ranges, AGE_BUCKETS[AGE_BUCKETS.length - 1].min)
        continue
      }
    }

    const singleMatch = text.match(/(age|ages|for|kids|children)[^0-9]{0,5}(\d{1,2})\s*(?:years?|yrs?)/)
    if (singleMatch) {
      const value = parseInt(singleMatch[2], 10)
      if (!isNaN(value)) {
        addAgeRangeForValue(ranges, value)
      }
    }
  }

  return Array.from(ranges)
}

function inferGender(texts: string[]): SuggestedGender | null {
  let mentionsMale = false
  let mentionsFemale = false

  for (const raw of texts) {
    if (!raw) continue
    const text = raw.toLowerCase()
    if (/(boys?|men's|male)/.test(text)) {
      mentionsMale = true
    }
    if (/(girls?|women's|female)/.test(text)) {
      mentionsFemale = true
    }
  }

  if (mentionsMale && mentionsFemale) return 'both'
  if (mentionsFemale) return 'female'
  if (mentionsMale) return 'male'
  return null
}

function normalizeHost(rawUrl: string): { host: MarketKey; url: URL } {
  const url = new URL(rawUrl)
  let host = url.hostname.replace(/^smile\./, '').replace(/^m\./, '')
  if (!Object.prototype.hasOwnProperty.call(MARKET_MAP, host)) {
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
          'Offers.Listings.Price',
          'ItemInfo.Classifications',
          'ItemInfo.ByLineInfo',
          'ItemInfo.ProductInfo'
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
    const pricePence = price?.Amount && price?.Currency === 'GBP'
      ? Math.round(price.Amount * 100)
      : undefined

    const textSamples: string[] = []
    if (title) textSamples.push(title)
    if (shortDescription) textSamples.push(shortDescription)
    if (Array.isArray(features)) {
      for (const feature of features) {
        if (feature) textSamples.push(String(feature))
      }
    }

    const ageRanges = inferAgeRanges(textSamples)
    const suggestedGender = inferGender(textSamples)

    const category =
      item.ItemInfo?.Classifications?.DisplayValues?.[0] ||
      item.ItemInfo?.ProductInfo?.ProductGroup?.DisplayValue ||
      undefined

    const affiliateLink = item.DetailPageURL || buildAffiliateLink(host, asin, tag)

    return {
      asin,
      affiliateLink,
      title,
      image,
      shortDescription,
      price: price?.Amount,
      currency: price?.Currency,
      pricePence,
      source: 'paapi',
      category,
      suggestedAgeRanges: ageRanges.length ? ageRanges : undefined,
      suggestedGender: suggestedGender ?? undefined
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
  let category: string | undefined
  const bulletTexts: string[] = []

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

    bulletTexts.push(...bullets)

    const breadcrumb = $('#wayfinding-breadcrumbs_feature_div li a span').last().text().trim()
    if (breadcrumb) {
      category = breadcrumb
    }
  } catch (error) {
    console.error('Amazon scrape failed:', error)
  }

  const affiliateLink = buildAffiliateLink(host, asin, trackingTag)

  const textSamples: string[] = []
  if (title) textSamples.push(title)
  if (shortDescription) textSamples.push(shortDescription)
  textSamples.push(...bulletTexts)

  const ageRanges = inferAgeRanges(textSamples)
  const suggestedGender = inferGender(textSamples)

  return {
    asin,
    affiliateLink,
    title,
    image,
    shortDescription,
    pricePence: undefined,
    source: 'scrape',
    category,
    suggestedAgeRanges: ageRanges.length ? ageRanges : undefined,
    suggestedGender: suggestedGender ?? undefined
  }
}

export async function resolveAmazonProduct({ url, config }: ResolveOptions): Promise<ProductInfo> {
  const { host, url: parsed } = normalizeHost(url)
  const asin = extractASIN(parsed)
  if (!asin) {
    throw new Error('Unable to find ASIN in Amazon URL')
  }

  const trackingTag = config.sitestripeTag || config.amazonTag || null

  const viaApi = await resolveViaPAAPI(host, asin, config, trackingTag)
  if (viaApi) {
    return viaApi
  }

  return resolveViaScrape(host, asin, trackingTag)
}

