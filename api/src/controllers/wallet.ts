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
    const { familyId, role, sub, childId: jwtChildId } = req.claims!
    const { childId } = req.params

    console.log('Wallet get request:', { childId, familyId, role, sub, jwtChildId })

    // For child users accessing their own wallet, always use the child's actual familyId from database
    let actualFamilyId = familyId
    
    if (role === 'child_player' && jwtChildId === childId) {
      console.log('Child accessing own wallet, getting familyId from database')
      const childRecord = await prisma.child.findUnique({
        where: { id: childId }
      })
      if (childRecord) {
        actualFamilyId = childRecord.familyId
        console.log('Using childs actual familyId from database:', actualFamilyId)
      } else {
        console.log('Child record not found in database, but child has valid JWT. Returning default wallet.')
        // If child record doesn't exist but JWT is valid, return a default wallet
        // This handles cases where child was deleted but JWT is still valid
        return { wallet: { balancePence: 0, transactions: [] } }
      }
    } else if (!actualFamilyId && role === 'child_player') {
      // Fallback for other child scenarios
      console.log('Missing familyId for child user, looking up from child record')
      const childRecord = await prisma.child.findUnique({
        where: { id: childId }
      })
      if (childRecord) {
        actualFamilyId = childRecord.familyId
        console.log('Found familyId from child record:', actualFamilyId)
      }
    }

    // If we still don't have a familyId, return error
    if (!actualFamilyId) {
      console.log('No familyId found for wallet request:', { childId, role })
      return reply.status(400).send({ error: 'Unable to determine family context' })
    }

    // For child users accessing their own wallet, we already verified the child exists above
    // For other cases, verify child belongs to family
    if (!(role === 'child_player' && jwtChildId === childId)) {
      const child = await prisma.child.findFirst({
        where: { id: childId, familyId: actualFamilyId }
      })

      if (!child) {
        console.log('Child not found for wallet request:', { childId, familyId: actualFamilyId })
        return reply.status(404).send({ error: 'Child not found in your family' })
      }
    }

    const wallet = await prisma.wallet.findFirst({
      where: { childId, familyId: actualFamilyId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    })

    return { wallet: wallet || { balancePence: 0, transactions: [] } }
  } catch (error) {
    console.error('Error getting wallet:', error)
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
