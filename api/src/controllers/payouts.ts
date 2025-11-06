import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

interface CreatePayoutBody {
  childId: string
  amountPence: number
  choreAmountPence?: number // Amount from chores (rest is from gifts)
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

    // Validate gift IDs if provided
    const giftIds = req.body.giftIds || []
    const choreAmountPence = req.body.choreAmountPence || 0
    let totalFromGifts = 0
    
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
      totalFromGifts = gifts.reduce((sum, g) => sum + g.moneyPence, 0)
    }

    // Validate that total amount = gifts + chores
    const calculatedTotal = totalFromGifts + choreAmountPence
    if (Math.abs(amountPence - calculatedTotal) > 0) {
      return reply.status(400).send({ 
        error: `Amount mismatch: total (${amountPence}) must equal gifts (${totalFromGifts}) + chores (${choreAmountPence}) = ${calculatedTotal}` 
      })
    }

    // Validate chore amount doesn't exceed available balance
    if (choreAmountPence < 0) {
      return reply.status(400).send({ error: 'Chore amount cannot be negative' })
    }
    if (choreAmountPence > wallet.balancePence) {
      return reply.status(400).send({ error: `Chore amount (${choreAmountPence}) exceeds available balance (${wallet.balancePence})` })
    }

    // Check if child has enough balance (including pending gift money if gifts are selected)
    // For gifts, we'll credit them first, then debit, so balance check includes gift money
    const availableBalance = wallet.balancePence + totalFromGifts
    if (availableBalance < amountPence) {
      return reply.status(400).send({ error: 'Insufficient balance' })
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // If gifts are being paid out, first credit them to the wallet (they were pending)
      if (giftIds.length > 0) {
        const gifts = await tx.gift.findMany({
          where: {
            id: { in: giftIds },
            familyId,
            childId,
            status: 'pending'
          }
        })
        
        const totalGiftAmount = gifts.reduce((sum, g) => sum + g.moneyPence, 0)
        
        // Credit the pending gift money to the wallet
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balancePence: { increment: totalGiftAmount }
          }
        })
        
        // Update the gift transaction metaJson to mark it as paid out
        // Find transactions for these gifts and update their status
        const giftTransactions = await tx.transaction.findMany({
          where: {
            walletId: wallet.id,
            familyId,
            type: 'credit',
            source: 'relative'
          }
        })
        
        for (const gift of gifts) {
          const giftTx = giftTransactions.find(t => {
            const meta = typeof t.metaJson === 'string' ? JSON.parse(t.metaJson) : (t.metaJson || {})
            return meta?.giftId === gift.id && meta?.type === 'gift_money'
          })
          
          if (giftTx) {
            const meta = typeof giftTx.metaJson === 'string' ? JSON.parse(giftTx.metaJson) : (giftTx.metaJson || {})
            await tx.transaction.update({
              where: { id: giftTx.id },
              data: {
                metaJson: {
                  ...meta,
                  status: 'paid_out'
                }
              }
            })
          }
        }
      }
      
      // Create payout record
      const payout = await tx.payout.create({
        data: {
          familyId,
          childId,
          amountPence,
          choreAmountPence: choreAmountPence > 0 ? choreAmountPence : null,
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

      // Debit from wallet (now that gift money has been credited)
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
            giftIds: giftIds,
            choreAmountPence: choreAmountPence > 0 ? choreAmountPence : 0,
            giftAmountPence: totalFromGifts
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

