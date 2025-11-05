import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import { cache, cacheKeys, cacheTTL } from '../utils/cache.js'

interface BuyStarsBody {
  starsRequested: number
}

interface StarPurchaseListQuery {
  status?: string
  childId?: string
}

/**
 * Create a buy stars request
 * @route POST /wallet/buy-stars
 * @description Child requests to buy stars using their pocket money
 * Money is deducted immediately, stars are awarded after parent approval
 */
export const buyStars = async (req: FastifyRequest<{ Body: BuyStarsBody }>, reply: FastifyReply) => {
  try {
    const { familyId, sub: childId } = req.claims!
    const { starsRequested } = req.body

    if (!starsRequested || starsRequested <= 0) {
      return reply.status(400).send({ error: 'Invalid number of stars requested' })
    }

    // Get family settings to check if feature is enabled and get conversion rate
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: {
        buyStarsEnabled: true,
        starConversionRatePence: true
      }
    })

    if (!family) {
      return reply.status(404).send({ error: 'Family not found' })
    }

    if (!family.buyStarsEnabled) {
      return reply.status(403).send({ error: 'Buy stars feature is disabled' })
    }

    const conversionRatePence = family.starConversionRatePence || 10 // Default 0.10p per star
    const amountPence = starsRequested * conversionRatePence

    // Get child's wallet to check balance
    const wallet = await prisma.wallet.findFirst({
      where: { familyId, childId }
    })

    if (!wallet) {
      return reply.status(404).send({ error: 'Wallet not found' })
    }

    if (wallet.balancePence < amountPence) {
      return reply.status(400).send({ error: 'Insufficient funds' })
    }

    // Deduct money immediately (optimistic UI)
    const result = await prisma.$transaction(async (tx) => {
      // Deduct money from wallet
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balancePence: {
            decrement: amountPence
          }
        }
      })

      // Create transaction record for money deduction
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          familyId,
          type: 'debit',
          amountPence,
          source: 'buy_stars',
          metaJson: {
            type: 'buy_stars_request',
            starsRequested,
            conversionRatePence
          }
        }
      })

      // Create star purchase request
      const starPurchase = await tx.starPurchase.create({
        data: {
          familyId,
          childId,
          amountPence,
          starsRequested,
          conversionRatePence,
          status: 'pending'
        },
        include: {
          child: {
            select: {
              id: true,
              nickname: true
            }
          }
        }
      })

      return { wallet: updatedWallet, starPurchase }
    })

    // Invalidate cache
    await cache.invalidateFamily(familyId)

    return {
      starPurchase: result.starPurchase,
      wallet: {
        balancePence: result.wallet.balancePence,
        stars: Math.floor(result.wallet.balanceStars)
      }
    }
  } catch (error: any) {
    console.error('Failed to create buy stars request:', error)
    reply.status(500).send({ error: 'Failed to create buy stars request', details: error.message })
  }
}

/**
 * List star purchase requests
 * @route GET /wallet/buy-stars
 * @description Get list of star purchase requests (for parent or child)
 */
export const listStarPurchases = async (req: FastifyRequest<{ Querystring: StarPurchaseListQuery }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { status, childId } = req.query

    const whereClause: any = { familyId }
    if (status) {
      whereClause.status = status
    }
    if (childId) {
      whereClause.childId = childId
    }

    const purchases = await prisma.starPurchase.findMany({
      where: whereClause,
      include: {
        child: {
          select: {
            id: true,
            nickname: true
          }
        },
        approvedByUser: {
          select: {
            id: true,
            email: true
          }
        },
        rejectedByUser: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    return { purchases }
  } catch (error: any) {
    console.error('Failed to list star purchases:', error)
    reply.status(500).send({ error: 'Failed to list star purchases', details: error.message })
  }
}

/**
 * Approve a star purchase request
 * @route POST /wallet/buy-stars/:id/approve
 * @description Parent approves the purchase, stars are awarded
 */
export const approveStarPurchase = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, sub: userId } = req.claims!
    const { id } = req.params

    // Find the purchase request
    const purchase = await prisma.starPurchase.findFirst({
      where: { id, familyId },
      include: {
        child: {
          select: {
            id: true,
            nickname: true
          }
        }
      }
    })

    if (!purchase) {
      return reply.status(404).send({ error: 'Star purchase request not found' })
    }

    if (purchase.status !== 'pending') {
      return reply.status(400).send({ error: 'Star purchase request has already been processed' })
    }

    // Approve and award stars
    const result = await prisma.$transaction(async (tx) => {
      // Get wallet
      const wallet = await tx.wallet.findFirst({
        where: { familyId, childId: purchase.childId }
      })

      if (!wallet) {
        throw new Error('Wallet not found')
      }

      // Award stars
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balanceStars: {
            increment: purchase.starsRequested
          }
        }
      })

      // Create transaction record for stars awarded
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          familyId,
          type: 'credit',
          amountPence: 0, // Stars don't have money value
          source: 'buy_stars_approved',
          metaJson: {
            type: 'buy_stars_approved',
            starsRequested: purchase.starsRequested,
            amountPence: purchase.amountPence,
            purchaseId: purchase.id
          }
        }
      })

      // Update purchase status
      const updatedPurchase = await tx.starPurchase.update({
        where: { id },
        data: {
          status: 'approved',
          approvedBy: userId,
          processedAt: new Date()
        },
        include: {
          child: {
            select: {
              id: true,
              nickname: true
            }
          },
          approvedByUser: {
            select: {
              id: true,
              email: true
            }
          }
        }
      })

      return { wallet: updatedWallet, purchase: updatedPurchase }
    })

    // Invalidate cache
    await cache.invalidateFamily(familyId)

    return {
      starPurchase: result.purchase,
      wallet: {
        balancePence: result.wallet.balancePence,
        stars: Math.floor(result.wallet.balanceStars)
      }
    }
  } catch (error: any) {
    console.error('Failed to approve star purchase:', error)
    reply.status(500).send({ error: 'Failed to approve star purchase', details: error.message })
  }
}

/**
 * Reject a star purchase request
 * @route POST /wallet/buy-stars/:id/reject
 * @description Parent rejects the purchase, money is refunded
 */
export const rejectStarPurchase = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, sub: userId } = req.claims!
    const { id } = req.params

    // Find the purchase request
    const purchase = await prisma.starPurchase.findFirst({
      where: { id, familyId },
      include: {
        child: {
          select: {
            id: true,
            nickname: true
          }
        }
      }
    })

    if (!purchase) {
      return reply.status(404).send({ error: 'Star purchase request not found' })
    }

    if (purchase.status !== 'pending') {
      return reply.status(400).send({ error: 'Star purchase request has already been processed' })
    }

    // Reject and refund money
    const result = await prisma.$transaction(async (tx) => {
      // Get wallet
      const wallet = await tx.wallet.findFirst({
        where: { familyId, childId: purchase.childId }
      })

      if (!wallet) {
        throw new Error('Wallet not found')
      }

      // Refund money
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balancePence: {
            increment: purchase.amountPence
          }
        }
      })

      // Create transaction record for refund
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          familyId,
          type: 'credit',
          amountPence: purchase.amountPence,
          source: 'buy_stars_refund',
          metaJson: {
            type: 'buy_stars_rejected',
            starsRequested: purchase.starsRequested,
            amountPence: purchase.amountPence,
            purchaseId: purchase.id,
            note: 'Refund for rejected star purchase'
          }
        }
      })

      // Update purchase status
      const updatedPurchase = await tx.starPurchase.update({
        where: { id },
        data: {
          status: 'rejected',
          rejectedBy: userId,
          processedAt: new Date()
        },
        include: {
          child: {
            select: {
              id: true,
              nickname: true
            }
          },
          rejectedByUser: {
            select: {
              id: true,
              email: true
            }
          }
        }
      })

      return { wallet: updatedWallet, purchase: updatedPurchase }
    })

    // Invalidate cache
    await cache.invalidateFamily(familyId)

    return {
      starPurchase: result.purchase,
      wallet: {
        balancePence: result.wallet.balancePence,
        stars: Math.floor(result.wallet.balanceStars)
      }
    }
  } catch (error: any) {
    console.error('Failed to reject star purchase:', error)
    reply.status(500).send({ error: 'Failed to reject star purchase', details: error.message })
  }
}

