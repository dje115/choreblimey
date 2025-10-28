import { PrismaClient } from '@prisma/client'

// Set the DATABASE_URL for Prisma (defaults to ADMIN_DATABASE_URL if set)
if (process.env.ADMIN_DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.ADMIN_DATABASE_URL
}

// Create Prisma client instance
export const prisma = new PrismaClient({
  log: ['error', 'warn']
})

export const connectAdminDatabase = async () => {
  try {
    await prisma.$connect()
    console.log('✅ Admin database connected successfully')
    return true
  } catch (error) {
    console.error('❌ Failed to connect to admin database:', error)
    throw error
  }
}

export const disconnectAdminDatabase = async () => {
  try {
    await prisma.$disconnect()
    console.log('✅ Admin database disconnected successfully')
  } catch (error) {
    console.error('❌ Failed to disconnect from admin database:', error)
    throw error
  }
}