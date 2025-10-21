import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

interface CreatePayoutBody {
  childId: string
  amountPence: number
  method?: 'cash' | 'bank_transfer' | 'other'
  note?: string
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

    // Create payout record
    const payout = await prisma.payout.create({
      data: {
        familyId,
        childId,
        amountPence,
        paidBy: sub,
        method: method || 'cash',
        note: note || null
      }
    })

    // Debit from wallet
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balancePence: { decrement: amountPence }
      }
    })

    // Create transaction record
    await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        familyId,
        type: 'debit',
        amountPence,
        source: 'parent',
        metaJson: {
          payoutId: payout.id,
          method: method || 'cash',
          note: note || null
        }
      }
    })

    return {
      payout,
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

    return { payouts }
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

