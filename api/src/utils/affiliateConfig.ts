import { prisma } from '../db/prisma.js'

export interface AffiliateConfig {
  amazonEnabled: boolean
  amazonAssociateId: string | null
  amazonAccessKey: string | null
  amazonSecretKey: string | null
  amazonTag: string | null
  sitestripeTag: string | null
  defaultImageUrl: string | null
  defaultStarValuePence: number
}

let cachedConfig: { config: AffiliateConfig; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function mapConfig(record: any): AffiliateConfig {
  return {
    amazonEnabled: record?.amazonEnabled ?? false,
    amazonAssociateId: record?.amazonAssociateId ?? null,
    amazonAccessKey: record?.amazonAccessKey ?? null,
    amazonSecretKey: record?.amazonSecretKey ?? null,
    amazonTag: record?.amazonTag ?? null,
    sitestripeTag: record?.sitestripeTag ?? null,
    defaultImageUrl: record?.defaultImageUrl ?? null,
    defaultStarValuePence: typeof record?.defaultStarValuePence === 'number' ? record.defaultStarValuePence : 10
  }
}

export async function getAffiliateConfig(forceRefresh = false): Promise<AffiliateConfig> {
  const now = Date.now()
  if (!forceRefresh && cachedConfig && now - cachedConfig.timestamp < CACHE_TTL) {
    return cachedConfig.config
  }

  const record = await prisma.affiliateConfig.findFirst({
    orderBy: { createdAt: 'asc' }
  })

  if (!record) {
    cachedConfig = {
      config: mapConfig(null),
      timestamp: now
    }
    return cachedConfig.config
  }

  const config = mapConfig(record)
  cachedConfig = { config, timestamp: now }
  return config
}

export function getTrackingTag(config: AffiliateConfig): string | null {
  return config.sitestripeTag || config.amazonTag || null
}

