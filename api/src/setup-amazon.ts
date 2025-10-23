import { prisma } from './db/prisma.js'

async function setupAmazon() {
  console.log('🛒 Amazon Integration Setup for ChoreBlimey')
  console.log('==========================================')
  
  // Check existing sources
  const existingSources = await prisma.rewardSource.findMany({
    where: { provider: 'amazon' }
  })
  
  console.log(`\n📊 Current Amazon sources: ${existingSources.length}`)
  existingSources.forEach(source => {
    console.log(`  - ${source.region} (${source.enabled ? '✅ Enabled' : '❌ Disabled'})`)
    console.log(`    ID: ${source.id}`)
    console.log(`    Tag: ${source.affiliateTag}`)
  })
  
  if (existingSources.length === 0) {
    console.log('\n🛠️  Creating test Amazon source...')
    
    const testSource = await prisma.rewardSource.create({
      data: {
        provider: 'amazon',
        region: 'UK',
        affiliateTag: 'choreblimey-21',
        apiKey: 'YOUR_AMAZON_ACCESS_KEY', // Will be encrypted when you update
        apiSecret: 'YOUR_AMAZON_SECRET_KEY', // Will be encrypted when you update
        enabled: false
      }
    })
    
    console.log('✅ Test source created!')
    console.log(`   ID: ${testSource.id}`)
    console.log(`   Region: ${testSource.region}`)
    console.log(`   Tag: ${testSource.affiliateTag}`)
    console.log(`   Enabled: ${testSource.enabled}`)
  }
  
  console.log('\n📝 Next steps for site owner:')
  console.log('1. Get Amazon Associates credentials from: https://affiliate-program.amazon.co.uk/')
  console.log('2. Use the admin API to update credentials:')
  console.log('   curl -X PATCH -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\')
  console.log('     -H "Content-Type: application/json" \\')
  console.log('     -d \'{"apiKey": "YOUR_REAL_KEY", "apiSecret": "YOUR_REAL_SECRET", "enabled": true}\' \\')
  console.log('     http://localhost:1501/v1/admin/affiliate-sources/SOURCE_ID')
  console.log('3. Monitor sync progress in worker logs')
  console.log('4. Check affiliate earnings in Amazon Associates dashboard')
}

setupAmazon()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
