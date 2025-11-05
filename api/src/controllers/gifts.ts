import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

interface CreateGiftBody {
  childId: string
  starsAmount?: number
  moneyPence?: number
  note?: string
}

interface UpdateGiftBody {
  starsAmount?: number
  moneyPence?: number
  note?: string
  status?: string
}

// Create a gift (stars and/or money) from an adult to a child
export const createGift = async (
  req: FastifyRequest<{ Body: CreateGiftBody }>,
  reply: FastifyReply
) => {
  try {
    const { familyId, sub: userId } = req.claims!
    const { childId, starsAmount = 0, moneyPence = 0, note } = req.body

    if (!childId) {
      return reply.status(400).send({ error: 'Child ID is required' })
    }

    if (starsAmount < 0 || moneyPence < 0) {
      return reply.status(400).send({ error: 'Gift amounts must be non-negative' })
    }

    if (starsAmount === 0 && moneyPence === 0) {
      return reply.status(400).send({ error: 'Must gift either stars or money (or both)' })
    }

    // Verify child belongs to family
    const child = await prisma.child.findFirst({
      where: { id: childId, familyId }
    })

    if (!child) {
      return reply.status(404).send({ error: 'Child not found' })
    }

    // Find the FamilyMember for the current user
    const familyMember = await prisma.familyMember.findFirst({
      where: {
        familyId,
        userId,
        role: {
          in: ['parent_admin', 'parent_co_parent', 'grandparent', 'uncle_aunt', 'relative_contributor']
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    })

    if (!familyMember) {
      return reply.status(403).send({ error: 'You are not authorized to gift to children' })
    }

    // Check if user has permission to gift
    if (starsAmount > 0 && !familyMember.giftStarsEnabled) {
      return reply.status(403).send({ error: 'You do not have permission to gift stars' })
    }

    if (moneyPence > 0 && !familyMember.giftMoneyEnabled) {
      return reply.status(403).send({ error: 'You do not have permission to gift money' })
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create gift record
      const gift = await tx.gift.create({
        data: {
          familyId,
          childId,
          givenBy: familyMember.id,
          starsAmount,
          moneyPence,
          note: note || null,
          status: 'pending'
        },
        include: {
          giver: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true
                }
              }
            }
          },
          child: {
            select: {
              id: true,
              nickname: true
            }
          }
        }
      })

      // If stars are being gifted, credit them immediately
      if (starsAmount > 0) {
        // Get or create wallet
        const wallet = await tx.wallet.upsert({
          where: {
            childId_familyId: {
              childId,
              familyId
            }
          },
          update: {
            stars: { increment: starsAmount }
          },
          create: {
            familyId,
            childId,
            balancePence: 0,
            stars: starsAmount
          }
        })

        // Create transaction record for stars
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            familyId,
            type: 'credit',
            amountPence: 0, // Stars-only transaction
            source: 'relative',
              metaJson: {
                giftId: gift.id,
                starsAmount,
                type: 'gift_stars',
                giverName: familyMember.displayName || familyMember.user?.email?.split('@')[0] || 'Unknown'
              }
          }
        })
      }

      // If money is being gifted, create transaction but DON'T update wallet balance yet
      // Balance will only be updated when the gift is paid out via payout
      if (moneyPence > 0) {
        // Get or create wallet (but don't update balance yet)
        const wallet = await tx.wallet.upsert({
          where: {
            childId_familyId: {
              childId,
              familyId
            }
          },
          update: {
            // Don't increment balance - money gifts are pending until paid out
          },
          create: {
            familyId,
            childId,
            balancePence: 0,
            stars: 0
          }
        })

        // Create transaction record for money gift (but don't affect balance yet)
        // This transaction will be marked as pending until payout
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            familyId,
            type: 'credit',
            amountPence: moneyPence,
            source: 'relative',
              metaJson: {
                giftId: gift.id,
                moneyPence,
                type: 'gift_money',
                giverName: familyMember.displayName || familyMember.user?.email?.split('@')[0] || 'Unknown',
                status: 'pending' // Money gift is pending until paid out
              }
          }
        })
      }

      return gift
    })

    return { gift: result }
  } catch (error) {
    console.error('Failed to create gift:', error)
    reply.status(500).send({ error: 'Failed to create gift' })
  }
}

// List gifts for a family or specific child
export const listGifts = async (
  req: FastifyRequest<{ Querystring: { childId?: string; status?: string } }>,
  reply: FastifyReply
) => {
  try {
    const { familyId } = req.claims!
    const { childId, status } = req.query

    const where: any = { familyId }
    if (childId) where.childId = childId
    if (status) where.status = status

    const gifts = await prisma.gift.findMany({
      where,
      include: {
        giver: {
          include: {
            user: {
              select: {
                id: true,
                email: true
              }
            }
          }
        },
        child: {
          select: {
            id: true,
            nickname: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return { gifts }
  } catch (error) {
    console.error('Failed to list gifts:', error)
    reply.status(500).send({ error: 'Failed to list gifts' })
  }
}

// Update a gift (only for cancelling or updating note)
export const updateGift = async (
  req: FastifyRequest<{ Params: { id: string }; Body: UpdateGiftBody }>,
  reply: FastifyReply
) => {
  try {
    const { familyId, sub: userId } = req.claims!
    const { id } = req.params
    const { note, status } = req.body

    // Find the gift
    const gift = await prisma.gift.findFirst({
      where: { id, familyId },
      include: {
        giver: true
      }
    })

    if (!gift) {
      return reply.status(404).send({ error: 'Gift not found' })
    }

    // Only allow the giver or a parent admin to update
    const familyMember = await prisma.familyMember.findFirst({
      where: {
        familyId,
        userId,
        role: {
          in: ['parent_admin', 'parent_co_parent']
        }
      }
    })

    const isGiver = gift.giver.userId === userId
    const isAdmin = familyMember?.role === 'parent_admin'

    if (!isGiver && !isAdmin) {
      return reply.status(403).send({ error: 'Not authorized to update this gift' })
    }

    // If cancelling, we need to reverse the transaction
    if (status === 'cancelled' && gift.status !== 'cancelled') {
      // Only allow cancelling if not already paid out
      if (gift.status === 'paid_out') {
        return reply.status(400).send({ error: 'Cannot cancel a gift that has already been paid out' })
      }

      await prisma.$transaction(async (tx) => {
        // Reverse stars if any
        if (gift.starsAmount > 0) {
          const wallet = await tx.wallet.findFirst({
            where: {
              childId: gift.childId,
              familyId
            }
          })

          if (wallet) {
            await tx.wallet.update({
              where: { id: wallet.id },
              data: {
                stars: { decrement: gift.starsAmount }
              }
            })

            // Create reversal transaction
            await tx.transaction.create({
              data: {
                walletId: wallet.id,
                familyId,
                type: 'debit',
                amountPence: 0,
                source: 'system',
                metaJson: {
                  giftId: gift.id,
                  starsAmount: gift.starsAmount,
                  type: 'gift_cancelled',
                  reason: 'Gift cancelled'
                }
              }
            })
          }
        }

        // Reverse money if any
        if (gift.moneyPence > 0) {
          const wallet = await tx.wallet.findFirst({
            where: {
              childId: gift.childId,
              familyId
            }
          })

          if (wallet) {
            await tx.wallet.update({
              where: { id: wallet.id },
              data: {
                balancePence: { decrement: gift.moneyPence }
              }
            })

            // Create reversal transaction
            await tx.transaction.create({
              data: {
                walletId: wallet.id,
                familyId,
                type: 'debit',
                amountPence: gift.moneyPence,
                source: 'system',
                metaJson: {
                  giftId: gift.id,
                  moneyPence: gift.moneyPence,
                  type: 'gift_cancelled',
                  reason: 'Gift cancelled'
                }
              }
            })
          }
        }

        // Update gift status
        await tx.gift.update({
          where: { id },
          data: {
            status: 'cancelled',
            note: note !== undefined ? note : gift.note
          }
        })
      })
    } else {
      // Just update note or other fields
      await prisma.gift.update({
        where: { id },
        data: {
          note: note !== undefined ? note : gift.note,
          status: status || gift.status
        }
      })
    }

    const updatedGift = await prisma.gift.findFirst({
      where: { id },
      include: {
        giver: {
          include: {
            user: {
              select: {
                id: true,
                email: true
              }
            }
          }
        },
        child: {
          select: {
            id: true,
            nickname: true
          }
        }
      }
    })

    return { gift: updatedGift }
  } catch (error) {
    console.error('Failed to update gift:', error)
    reply.status(500).send({ error: 'Failed to update gift' })
  }
}

// Delete a gift (only if not paid out)
export const deleteGift = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const { familyId, sub: userId } = req.claims!
    const { id } = req.params

    const gift = await prisma.gift.findFirst({
      where: { id, familyId },
      include: {
        giver: true
      }
    })

    if (!gift) {
      return reply.status(404).send({ error: 'Gift not found' })
    }

    if (gift.status === 'paid_out') {
      return reply.status(400).send({ error: 'Cannot delete a gift that has been paid out' })
    }

    // Only allow the giver or a parent admin to delete
    const familyMember = await prisma.familyMember.findFirst({
      where: {
        familyId,
        userId,
        role: {
          in: ['parent_admin', 'parent_co_parent']
        }
      }
    })

    const isGiver = gift.giver.userId === userId
    const isAdmin = familyMember?.role === 'parent_admin'

    if (!isGiver && !isAdmin) {
      return reply.status(403).send({ error: 'Not authorized to delete this gift' })
    }

    // Cancel the gift first (which reverses transactions)
    await updateGift(
      req as any,
      { ...reply, status: (code: number) => reply.status(code) } as any
    )

    // Then delete it
    await prisma.gift.delete({
      where: { id }
    })

    return { message: 'Gift deleted successfully' }
  } catch (error) {
    console.error('Failed to delete gift:', error)
    reply.status(500).send({ error: 'Failed to delete gift' })
  }
}

