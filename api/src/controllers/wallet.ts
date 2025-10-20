import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

interface WalletCreditBody {
  amountPence: number
  source?: 'parent' | 'relative'
  note?: string
}

interface WalletDebitBody {
  amountPence: number
  note?: string
}

export const get = async (req: FastifyRequest<{ Params: { childId: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { childId } = req.params

    // Verify child belongs to family
    const child = await prisma.child.findFirst({
      where: { id: childId, familyId }
    })

    if (!child) {
      return reply.status(404).send({ error: 'Child not found' })
    }

    const wallet = await prisma.wallet.findFirst({
      where: { childId, familyId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    })

    return { wallet: wallet || { balancePence: 0, transactions: [] } }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to get wallet' })
  }
}

export const credit = async (req: FastifyRequest<{ Params: { childId: string }, Body: WalletCreditBody }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { childId } = req.params
    const { amountPence, source = 'parent', note } = req.body

    if (amountPence <= 0) {
      return reply.status(400).send({ error: 'Amount must be positive' })
    }

    // Verify child belongs to family
    const child = await prisma.child.findFirst({
      where: { id: childId, familyId }
    })

    if (!child) {
      return reply.status(404).send({ error: 'Child not found' })
    }

    // Update or create wallet
    const wallet = await prisma.wallet.upsert({
      where: {
        childId_familyId: {
          childId,
          familyId
        }
      },
      update: {
        balancePence: { increment: amountPence }
      },
      create: {
        familyId,
        childId,
        balancePence: amountPence
      }
    })

    // Create transaction record
    await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        familyId,
        type: 'credit',
        amountPence,
        source,
        metaJson: { note }
      }
    })

    return { wallet }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to credit wallet' })
  }
}

export const debit = async (req: FastifyRequest<{ Params: { childId: string }, Body: WalletDebitBody }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { childId } = req.params
    const { amountPence, note } = req.body

    if (amountPence <= 0) {
      return reply.status(400).send({ error: 'Amount must be positive' })
    }

    // Verify child belongs to family
    const child = await prisma.child.findFirst({
      where: { id: childId, familyId }
    })

    if (!child) {
      return reply.status(404).send({ error: 'Child not found' })
    }

    // Get current wallet
    let wallet = await prisma.wallet.findFirst({
      where: { childId, familyId }
    })

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { familyId, childId, balancePence: 0 }
      })
    }

    if (wallet.balancePence < amountPence) {
      return reply.status(400).send({ error: 'Insufficient balance' })
    }

    // Update wallet
    const updatedWallet = await prisma.wallet.update({
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
        source: 'system',
        metaJson: { note }
      }
    })

    return { wallet: updatedWallet }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to debit wallet' })
  }
}
