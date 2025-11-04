import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfillGiftCreatedBy() {
  try {
    // Find David's user ID
    const david = await prisma.user.findUnique({
      where: { email: 'david@mayband.co.uk' }
    })

    if (!david) {
      console.error('❌ David user not found')
      process.exit(1)
    }

    console.log(`✅ Found David: ${david.id}`)

    // Update all gifts without createdBy to be created by David
    const result = await prisma.familyGift.updateMany({
      where: {
        createdBy: null
      },
      data: {
        createdBy: david.id
      }
    })

    console.log(`✅ Updated ${result.count} gifts with createdBy = ${david.id}`)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

backfillGiftCreatedBy()

