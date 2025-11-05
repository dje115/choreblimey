import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

interface CreatePayoutBody {
  childId: string
  amountPence: number
  method?: 'cash' | 'bank_transfer' | 'other'
  note?: string
  giftIds?: string[] // IDs of gifts to mark as paid out
}

export const create = async (req: FastifyRequest<{ Body: CreatePayoutBody }>, reply: FastifyReply) => {
  try {
    const { familyId, sub } = req.claims!
    const { childId, amountPence, method, note } = req.body

    if (!childId) {
      return reply.status(400).send({ error: 'Child ID is required' })
    }

    if (!amountPence || amountPence <= 0) {
      return reply.status(400).send({ error: 'Amount must be greater than 0' })
    }

    // Verify child belongs to family
    const child = await prisma.child.findFirst({
      where: { id: childId, familyId }
    })

    if (!child) {
      return reply.status(404).send({ error: 'Child not found' })
    }

    // Get child's wallet
    const wallet = await prisma.wallet.findFirst({
      where: { childId, familyId }
    })

    if (!wallet) {
      return reply.status(404).send({ error: 'Wallet not found' })
    }

    // Check if child has enough balance
    if (wallet.balancePence < amountPence) {
      return reply.status(400).send({ error: 'Insufficient balance' })
    }

    // Validate gift IDs if provided
    const giftIds = req.body.giftIds || []
    if (giftIds.length > 0) {
      const gifts = await prisma.gift.findMany({
        where: {
          id: { in: giftIds },
          familyId,
          childId,
          status: 'pending'
        }
      })

      if (gifts.length !== giftIds.length) {
        return reply.status(400).send({ error: 'One or more gift IDs are invalid or already paid out' })
      }

      // Calculate total from selected gifts
      const totalFromGifts = gifts.reduce((sum, g) => sum + g.moneyPence, 0)
      if (amountPence !== totalFromGifts) {
        return reply.status(400).send({ error: `Amount must match total of selected gifts (${totalFromGifts} pence)` })
      }
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create payout record
      const payout = await tx.payout.create({
        data: {
          familyId,
          childId,
          amountPence,
          paidBy: sub,
          method: method || 'cash',
          note: note || null,
          giftIds: giftIds
        }
      })

      // Update gift statuses if gifts were selected
      if (giftIds.length > 0) {
        await tx.gift.updateMany({
          where: {
            id: { in: giftIds }
          },
          data: {
            status: 'paid_out',
            paidOutAt: new Date(),
            payoutId: payout.id
          }
        })
      }

      // Debit from wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balancePence: { decrement: amountPence }
        }
      })

      // Create transaction record
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          familyId,
          type: 'debit',
          amountPence,
          source: 'parent',
          metaJson: {
            payoutId: payout.id,
            method: method || 'cash',
            note: note || null,
            giftIds: giftIds
          }
        }
      })

      return payout
    })

    return {
      payout: result,
      message: 'Payout successful'
    }
  } catch (error) {
    console.error('Failed to create payout:', error)
    reply.status(500).send({ error: 'Failed to create payout' })
  }
}

export const list = async (req: FastifyRequest<{ Querystring: { childId?: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { childId } = req.query

    const where: any = { familyId }
    if (childId) {
      where.childId = childId
    }

    const payouts = await prisma.payout.findMany({
      where,
      include: {
        child: {
          select: {
            id: true,
            nickname: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get user info for paidBy fields
    const userIds = payouts.filter(p => p.paidBy).map(p => p.paidBy!)
    const uniqueUserIds = [...new Set(userIds)]
    
    const users = uniqueUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: uniqueUserIds } },
          select: { id: true, email: true }
        })
      : []
    
    const userMap = new Map(users.map(u => [u.id, u]))
    
    // Add paidByUser info to each payout
    const payoutsWithUser = payouts.map(payout => ({
      ...payout,
      paidByUser: payout.paidBy ? userMap.get(payout.paidBy) : null
    }))

    return { payouts: payoutsWithUser }
  } catch (error) {
    console.error('Failed to list payouts:', error)
    reply.status(500).send({ error: 'Failed to list payouts' })
  }
}

export const getUnpaidBalance = async (req: FastifyRequest<{ Params: { childId: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { childId } = req.params

    // Get child's wallet
    const wallet = await prisma.wallet.findFirst({
      where: { childId, familyId }
    })

    if (!wallet) {
      return reply.status(404).send({ error: 'Wallet not found' })
    }

    // Get total paid out
    const payouts = await prisma.payout.findMany({
      where: { childId, familyId }
    })

    const totalPaidPence = payouts.reduce((sum, p) => sum + p.amountPence, 0)
    
    // Current balance is what they have left after payouts (already tracked in wallet)
    const unpaidBalancePence = wallet.balancePence

    return {
      childId,
      currentBalancePence: wallet.balancePence,
      totalPaidPence,
      unpaidBalancePence
    }
  } catch (error) {
    console.error('Failed to get unpaid balance:', error)
    reply.status(500).send({ error: 'Failed to get unpaid balance' })
  }
}

