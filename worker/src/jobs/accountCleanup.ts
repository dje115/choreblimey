/**
 * Account Cleanup Job
 * 
 * Handles automatic account deletion based on inactivity:
 * - 5 months: Send warning email to inactive accounts
 * - 6 months: Delete inactive accounts
 * - 11 months: Send warning email to suspended accounts  
 * - 12 months: Delete suspended accounts
 * 
 * Runs monthly to keep things tidy
 */

import { PrismaClient } from '@prisma/client'
import { sendEmail } from '../utils/email.js'

const prisma = new PrismaClient()

interface CleanupStats {
  warningEmailsSent: number
  accountsDeleted: number
  suspendedWarningsSent: number
  suspendedAccountsDeleted: number
}

export async function accountCleanup(job: any) {
  console.log('🧹 Starting account cleanup job...')
  
  const stats: CleanupStats = {
    warningEmailsSent: 0,
    accountsDeleted: 0,
    suspendedWarningsSent: 0,
    suspendedAccountsDeleted: 0
  }

  try {
    // 1. Find accounts that are 5 months inactive (send warning)
    const fiveMonthsAgo = new Date()
    fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5)
    
    const inactiveAccounts = await prisma.family.findMany({
      where: {
        // Account created more than 5 months ago
        createdAt: {
          lt: fiveMonthsAgo
        },
        // No login activity in last 5 months
        lastLoginAt: {
          lt: fiveMonthsAgo
        },
        // Not suspended (suspended accounts have different timeline)
        suspendedAt: null
      },
      include: {
        members: {
          include: {
            user: true
          }
        }
      }
    })

    console.log(`📧 Found ${inactiveAccounts.length} accounts at 5 months - sending warnings`)

    // Send 5-month warning emails (30 days before deletion)
    for (const family of inactiveAccounts) {
      const parentEmails = family.members
        .filter(member => member.role === 'parent_admin')
        .map(member => member.user.email)

      for (const email of parentEmails) {
        try {
          await sendEmail({
            to: email,
            subject: 'ChoreBlimey Account - 30 Days Until Deletion',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #ff6b6b;">⚠️ Account Deletion Warning</h1>
                <p>Your ChoreBlimey family account hasn't been used in 5 months and will be automatically deleted in 30 days.</p>
                <p><strong>To keep your account:</strong> Simply log in to ChoreBlimey anytime in the next 30 days.</p>
                <p><strong>To suspend your account:</strong> Log in and click "Suspend Account" to prevent deletion for 12 months.</p>
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                  <h3>⚠️ What happens if deleted:</h3>
                  <ul>
                    <li>All family data will be permanently removed</li>
                    <li>All chore history will be lost</li>
                    <li>All child progress will be deleted</li>
                    <li>All earned stars and rewards will be lost</li>
                  </ul>
                </div>
                <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                  <h3>✅ How to keep your account:</h3>
                  <ul>
                    <li>Log in to ChoreBlimey anytime in the next 30 days</li>
                    <li>Or click "Suspend Account" to prevent deletion for 12 months</li>
                    <li>Any family member login will reset the timer</li>
                  </ul>
                </div>
                <p>Visit <a href="https://choreblimey.com" style="color: #6DA3FF; text-decoration: none; font-weight: bold;">ChoreBlimey.com</a> to log in and keep your account active.</p>
                <p style="color: #666; font-size: 14px;">This is an automated message. Please do not reply.</p>
              </div>
            `
          })
          stats.warningEmailsSent++
          console.log(`📧 Sent 5-month warning email to ${email}`)
        } catch (error) {
          console.error(`Failed to send warning email to ${email}:`, error)
        }
      }
    }

    // 2. Find accounts that are 6 months inactive (delete them)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    
    const accountsToDelete = await prisma.family.findMany({
      where: {
        // Account created more than 6 months ago
        createdAt: {
          lt: sixMonthsAgo
        },
        // No login activity in last 6 months
        lastLoginAt: {
          lt: sixMonthsAgo
        },
        // Not suspended (suspended accounts have different timeline)
        suspendedAt: null
      }
    })

    console.log(`🗑️ Found ${accountsToDelete.length} accounts at 6 months - deleting`)

    // Delete accounts with proper cascade handling
    for (const family of accountsToDelete) {
      try {
        await prisma.$transaction(async (tx) => {
          // Delete all related data in the correct order
          await tx.assignment.deleteMany({ where: { familyId: family.id } })
          await tx.completion.deleteMany({ where: { familyId: family.id } })
          await tx.bid.deleteMany({ where: { familyId: family.id } })
          await tx.chore.deleteMany({ where: { familyId: family.id } })
          await tx.child.deleteMany({ where: { familyId: family.id } })
          await tx.familyMember.deleteMany({ where: { familyId: family.id } })
          await tx.wallet.deleteMany({ where: { familyId: family.id } })
          await tx.transaction.deleteMany({ where: { familyId: family.id } })
          await tx.streak.deleteMany({ where: { familyId: family.id } })
          await tx.reward.deleteMany({ where: { familyId: family.id } })
          await tx.redemption.deleteMany({ where: { familyId: family.id } })
          await tx.payout.deleteMany({ where: { familyId: family.id } })
          await tx.bonusRule.deleteMany({ where: { familyId: family.id } })
          await tx.penaltyRule.deleteMany({ where: { familyId: family.id } })
          await tx.rivalryEvent.deleteMany({ where: { familyId: family.id } })
          await tx.auditLog.deleteMany({ where: { familyId: family.id } })
          await tx.childJoinCode.deleteMany({ where: { familyId: family.id } })
          await tx.authToken.deleteMany({ where: { familyId: family.id } })
          
          // Finally delete the family
          await tx.family.delete({ where: { id: family.id } })
        })
        stats.accountsDeleted++
        console.log(`✅ Deleted family account: ${family.id}`)
      } catch (error) {
        console.error(`Failed to delete family ${family.id}:`, error)
      }
    }

    // 3. Find suspended accounts that are 11 months old (send warning)
    const elevenMonthsAgo = new Date()
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11)
    
    const suspendedAccounts = await prisma.family.findMany({
      where: {
        // Account was suspended more than 11 months ago
        suspendedAt: {
          lt: elevenMonthsAgo
        }
      },
      include: {
        members: {
          include: {
            user: true
          }
        }
      }
    })

    console.log(`📧 Found ${suspendedAccounts.length} suspended accounts at 11 months - sending warnings`)

    // Send 11-month warning emails to suspended accounts (30 days before deletion)
    for (const family of suspendedAccounts) {
      const parentEmails = family.members
        .filter(member => member.role === 'parent_admin')
        .map(member => member.user.email)

      for (const email of parentEmails) {
        try {
          await sendEmail({
            to: email,
            subject: 'ChoreBlimey Suspended Account - 30 Days Until Deletion',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #ff6b6b;">⚠️ Suspended Account Deletion Warning</h1>
                <p>Your suspended ChoreBlimey family account will be permanently deleted in 30 days.</p>
                <p><strong>To reactivate:</strong> Simply log in to ChoreBlimey anytime in the next 30 days.</p>
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                  <h3>⚠️ What happens if deleted:</h3>
                  <ul>
                    <li>All family data will be permanently removed</li>
                    <li>All chore history will be lost</li>
                    <li>All child progress will be deleted</li>
                    <li>All earned stars and rewards will be lost</li>
                    <li>You'll need to start over if you want to use ChoreBlimey again</li>
                  </ul>
                </div>
                <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                  <h3>✅ How to reactivate:</h3>
                  <ul>
                    <li>Log in to ChoreBlimey anytime in the next 30 days</li>
                    <li>Your account will be automatically reactivated</li>
                    <li>All your data will be preserved</li>
                  </ul>
                </div>
                <p>Visit <a href="https://choreblimey.com" style="color: #6DA3FF; text-decoration: none; font-weight: bold;">ChoreBlimey.com</a> to log in and reactivate your account.</p>
                <p style="color: #666; font-size: 14px;">This is an automated message. Please do not reply.</p>
              </div>
            `
          })
          stats.suspendedWarningsSent++
          console.log(`📧 Sent 11-month suspended warning email to ${email}`)
        } catch (error) {
          console.error(`Failed to send suspended warning email to ${email}:`, error)
        }
      }
    }

    // 4. Find suspended accounts that are 12 months old (delete them)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    
    const suspendedAccountsToDelete = await prisma.family.findMany({
      where: {
        // Account was suspended more than 12 months ago
        suspendedAt: {
          lt: twelveMonthsAgo
        }
      }
    })

    console.log(`🗑️ Found ${suspendedAccountsToDelete.length} suspended accounts at 12 months - deleting`)

    // Delete suspended accounts with proper cascade handling
    for (const family of suspendedAccountsToDelete) {
      try {
        await prisma.$transaction(async (tx) => {
          // Delete all related data in the correct order
          await tx.assignment.deleteMany({ where: { familyId: family.id } })
          await tx.completion.deleteMany({ where: { familyId: family.id } })
          await tx.bid.deleteMany({ where: { familyId: family.id } })
          await tx.chore.deleteMany({ where: { familyId: family.id } })
          await tx.child.deleteMany({ where: { familyId: family.id } })
          await tx.familyMember.deleteMany({ where: { familyId: family.id } })
          await tx.wallet.deleteMany({ where: { familyId: family.id } })
          await tx.transaction.deleteMany({ where: { familyId: family.id } })
          await tx.streak.deleteMany({ where: { familyId: family.id } })
          await tx.reward.deleteMany({ where: { familyId: family.id } })
          await tx.redemption.deleteMany({ where: { familyId: family.id } })
          await tx.payout.deleteMany({ where: { familyId: family.id } })
          await tx.bonusRule.deleteMany({ where: { familyId: family.id } })
          await tx.penaltyRule.deleteMany({ where: { familyId: family.id } })
          await tx.rivalryEvent.deleteMany({ where: { familyId: family.id } })
          await tx.auditLog.deleteMany({ where: { familyId: family.id } })
          await tx.childJoinCode.deleteMany({ where: { familyId: family.id } })
          await tx.authToken.deleteMany({ where: { familyId: family.id } })
          
          // Finally delete the family
          await tx.family.delete({ where: { id: family.id } })
        })
        stats.suspendedAccountsDeleted++
        console.log(`✅ Deleted suspended family account: ${family.id}`)
      } catch (error) {
        console.error(`Failed to delete suspended family ${family.id}:`, error)
      }
    }

    console.log('✅ Account cleanup completed:', stats)
    return stats

  } catch (error) {
    console.error('❌ Account cleanup failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}
