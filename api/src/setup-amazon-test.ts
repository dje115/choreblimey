/**
 * Setup Amazon PA-API test configuration
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function setupAmazonTest() {
  console.log('🛒 Setting up Amazon test configuration...')
  
  try {
    // Create a test Amazon reward source
    const testSource = await prisma.rewardSource.upsert({
      where: {
        provider_region: {
          provider: 'amazon',
          region: 'UK'
        }
      },
      create: {
        provider: 'amazon',
        affiliateTag: 'choreblimey-21', // Replace with your Amazon Associates tag
        apiKey: 'YOUR_AMAZON_ACCESS_KEY', // Replace with real access key
        apiSecret: 'YOUR_AMAZON_SECRET_KEY', // Replace with real secret key
        enabled: false, // Start disabled until real credentials are added
        region: 'UK'
      },
      update: {
        enabled: false
      }
    })
    
    console.log('✅ Amazon test source created:', {
      id: testSource.id,
      provider: testSource.provider,
      region: testSource.region,
      affiliateTag: testSource.affiliateTag,
      enabled: testSource.enabled
    })
    
    console.log('\n📝 Next steps:')
    console.log('1. Get Amazon Associates credentials from: https://affiliate-program.amazon.co.uk/')
    console.log('2. Update the apiKey and apiSecret in the database')
    console.log('3. Replace affiliateTag with your actual Associates tag')
    console.log('4. Set enabled: true to start syncing')
    
  } catch (error) {
    console.error('❌ Failed to setup Amazon test:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setupAmazonTest()

