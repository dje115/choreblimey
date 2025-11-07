import type { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../db/prisma.js'

function sanitizeConfig(config: any) {
  if (!config) return null
  return {
    id: config.id,
    amazonEnabled: config.amazonEnabled,
    amazonAssociateId: config.amazonAssociateId ?? '',
    amazonAccessKey: config.amazonAccessKey ?? '',
    amazonSecretKey: config.amazonSecretKey ?? '',
    amazonTag: config.amazonTag ?? '',
    sitestripeTag: config.sitestripeTag ?? '',
    defaultImageUrl: config.defaultImageUrl ?? '',
    createdAt: config.createdAt,
    updatedAt: config.updatedAt
  }
}

async function ensureConfig() {
  const existing = await prisma.affiliateConfig.findFirst({
    orderBy: { createdAt: 'asc' }
  })

  if (existing) return existing

  return prisma.affiliateConfig.create({
    data: {}
  })
}

export const getConfig = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const config = await ensureConfig()
    return { config: sanitizeConfig(config) }
  } catch (error) {
    req.log.error(error, 'Failed to load affiliate configuration')
    reply.status(500).send({ error: 'Failed to load affiliate configuration' })
  }
}

interface UpdateAffiliateBody {
  amazonEnabled?: boolean
  amazonAssociateId?: string
  amazonAccessKey?: string
  amazonSecretKey?: string
  amazonTag?: string
  sitestripeTag?: string
  defaultImageUrl?: string
}

export const updateConfig = async (
  req: FastifyRequest<{ Body: UpdateAffiliateBody }>,
  reply: FastifyReply
) => {
  try {
    const body = req.body || {}

    const trimmed = {
      amazonAssociateId: body.amazonAssociateId?.trim() || null,
      amazonAccessKey: body.amazonAccessKey?.trim() || null,
      amazonSecretKey: body.amazonSecretKey?.trim() || null,
      amazonTag: body.amazonTag?.trim() || null,
      sitestripeTag: body.sitestripeTag?.trim() || null,
      defaultImageUrl: body.defaultImageUrl?.trim() || null
    }

    const config = await ensureConfig()

    const updated = await prisma.affiliateConfig.update({
      where: { id: config.id },
      data: {
        amazonEnabled: body.amazonEnabled ?? config.amazonEnabled,
        amazonAssociateId: trimmed.amazonAssociateId,
        amazonAccessKey: trimmed.amazonAccessKey,
        amazonSecretKey: trimmed.amazonSecretKey,
        amazonTag: trimmed.amazonTag,
        sitestripeTag: trimmed.sitestripeTag,
        defaultImageUrl: trimmed.defaultImageUrl
      }
    })

    return { config: sanitizeConfig(updated) }
  } catch (error) {
    req.log.error(error, 'Failed to update affiliate configuration')
    reply.status(500).send({ error: 'Failed to update affiliate configuration' })
  }
}

