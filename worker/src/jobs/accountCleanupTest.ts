/**
 * TEST VERSION: Account Cleanup Job
 * 
 * TESTING: Set to 1 day for testing, then revert to normal times
 * - 1 day: Send warning email to inactive accounts
 * - 1 day: Delete inactive accounts
 * - 1 day: Send warning email to suspended accounts  
 * - 1 day: Delete suspended accounts
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

export async function accountCleanupTest(job: any) {
  console.log('🧹 Starting TEST account cleanup job (1-day deletion)...')
  
  const stats: CleanupStats = {
    warningEmailsSent: 0,
    accountsDeleted: 0,
    suspendedWarningsSent: 0,
    suspendedAccountsDeleted: 0
  }

  try {
    // 1. Find accounts that are 1 day inactive (send warning)
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    
    const inactiveAccounts = await prisma.family.findMany({
      where: {
        // Account created more than 1 day ago
        createdAt: {
          lt: oneDayAgo
        },
        // No login activity in last 1 day
        lastLoginAt: {
          lt: oneDayAgo
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
      }
    })

    console.log(`📧 Found ${inactiveAccounts.length} accounts at 1 day - sending warnings`)

    // Send warning emails
    for (const family of inactiveAccounts) {
      const parentEmails = family.members
        .filter(member => member.role === 'parent_admin')
        .map(member => member.user.email)

      for (const email of parentEmails) {
        try {
          await sendEmail({
            to: email,
            subject: 'TEST: ChoreBlimey Account - 1 Day Until Deletion',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #6DA3FF;">⚠️ TEST: Account Deletion Warning</h1>
                <p><strong>THIS IS A TEST:</strong> Your ChoreBlimey family account hasn't been used in 1 day and will be automatically deleted in 1 day.</p>
                <p><strong>To keep your account:</strong> Simply log in to ChoreBlimey anytime in the next 1 day.</p>
                <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h3>What happens if deleted:</h3>
                  <ul>
                    <li>All family data will be permanently removed</li>
                    <li>All chore history will be lost</li>
                    <li>All child progress will be deleted</li>
                  </ul>
                </div>
                <p>Visit <a href="https://choreblimey.com">ChoreBlimey.com</a> to log in and keep your account active.</p>
                <p style="color: #666; font-size: 14px;">This is a TEST automated message. Please do not reply.</p>
              </div>
            `
          })
          stats.warningEmailsSent++
        } catch (error) {
          console.error(`Failed to send warning email to ${email}:`, error)
        }
      }
    }

    // 2. Find accounts that are 1 day inactive (delete them)
    const oneDayAgoDelete = new Date()
    oneDayAgoDelete.setDate(oneDayAgoDelete.getDate() - 1)
    
    const accountsToDelete = await prisma.family.findMany({
      where: {
        // Account created more than 1 day ago
        createdAt: {
          lt: oneDayAgoDelete
        },
        // No login activity in last 1 day
        lastLoginAt: {
          lt: oneDayAgoDelete
        },
        // Not suspended (suspended accounts have different timeline)
        suspendedAt: null
      }
    })

    console.log(`🗑️ Found ${accountsToDelete.length} accounts at 1 day - deleting`)

    // Delete accounts (cascade will handle related data)
    for (const family of accountsToDelete) {
      try {
        await prisma.family.delete({
          where: { id: family.id }
        })
        stats.accountsDeleted++
        console.log(`✅ TEST: Deleted family account: ${family.id}`)
      } catch (error) {
        console.error(`Failed to delete family ${family.id}:`, error)
      }
    }

    // 3. Find suspended accounts that are 1 day old (send warning)
    const oneDayAgoSuspended = new Date()
    oneDayAgoSuspended.setDate(oneDayAgoSuspended.getDate() - 1)
    
    const suspendedAccounts = await prisma.family.findMany({
      where: {
        // Account was suspended more than 1 day ago
        suspendedAt: {
          lt: oneDayAgoSuspended
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

    console.log(`📧 Found ${suspendedAccounts.length} suspended accounts at 1 day - sending warnings`)

    // Send warning emails to suspended accounts
    for (const family of suspendedAccounts) {
      const parentEmails = family.members
        .filter(member => member.role === 'parent_admin')
        .map(member => member.user.email)

      for (const email of parentEmails) {
        try {
          await sendEmail({
            to: email,
            subject: 'TEST: ChoreBlimey Suspended Account - 1 Day Until Deletion',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #6DA3FF;">⚠️ TEST: Suspended Account Deletion Warning</h1>
                <p><strong>THIS IS A TEST:</strong> Your suspended ChoreBlimey family account will be permanently deleted in 1 day.</p>
                <p><strong>To reactivate:</strong> Simply log in to ChoreBlimey anytime in the next 1 day.</p>
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h3>What happens if deleted:</h3>
                  <ul>
                    <li>All family data will be permanently removed</li>
                    <li>All chore history will be lost</li>
                    <li>All child progress will be deleted</li>
                    <li>You'll need to start over if you want to use ChoreBlimey again</li>
                  </ul>
                </div>
                <p>Visit <a href="https://choreblimey.com">ChoreBlimey.com</a> to log in and reactivate your account.</p>
                <p style="color: #666; font-size: 14px;">This is a TEST automated message. Please do not reply.</p>
              </div>
            `
          })
          stats.suspendedWarningsSent++
        } catch (error) {
          console.error(`Failed to send suspended warning email to ${email}:`, error)
        }
      }
    }

    // 4. Find suspended accounts that are 1 day old (delete them)
    const oneDayAgoSuspendedDelete = new Date()
    oneDayAgoSuspendedDelete.setDate(oneDayAgoSuspendedDelete.getDate() - 1)
    
    const suspendedAccountsToDelete = await prisma.family.findMany({
      where: {
        // Account was suspended more than 1 day ago
        suspendedAt: {
          lt: oneDayAgoSuspendedDelete
        }
      }
    })

    console.log(`🗑️ Found ${suspendedAccountsToDelete.length} suspended accounts at 1 day - deleting`)

    // Delete suspended accounts
    for (const family of suspendedAccountsToDelete) {
      try {
        await prisma.family.delete({
          where: { id: family.id }
        })
        stats.suspendedAccountsDeleted++
        console.log(`✅ TEST: Deleted suspended family account: ${family.id}`)
      } catch (error) {
        console.error(`Failed to delete suspended family ${family.id}:`, error)
      }
    }

    console.log('✅ TEST account cleanup completed:', stats)
    return stats

  } catch (error) {
    console.error('❌ TEST account cleanup failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}
