import { prisma } from './db/prisma.js'
import jwt from 'jsonwebtoken'

async function createTestUser() {
  console.log('🔧 Creating test user and authentication...')

  // Create a test user
  const user = await prisma.user.create({
    data: {
      email: 'test@choreblimey.com'
    }
  })

  console.log('✅ Created test user:', user.email)

  // Create a family for the user
  const family = await prisma.family.create({
    data: {
      nameCipher: 'Test Family',
      region: 'UK'
    }
  })

  console.log('✅ Created test family:', family.id)

  // Add user as admin to the family
  await prisma.familyMember.create({
    data: {
      familyId: family.id,
      userId: user.id,
      role: 'parent_admin'
    }
  })

  console.log('✅ Added user to family as admin')

  // Generate JWT token
  const token = jwt.sign(
    {
      sub: user.id,
      role: 'parent_admin',
      familyId: family.id,
      email: user.email
    },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  )

  console.log('🔑 Test JWT Token:')
  console.log(token)
  console.log('')
  console.log('📝 To use this token:')
  console.log('1. Open browser developer tools (F12)')
  console.log('2. Go to Application/Storage tab')
  console.log('3. Find Local Storage for localhost:1500')
  console.log('4. Add key "auth_token" with value:', token)
  console.log('5. Refresh the page')

  return { user, family, token }
}

createTestUser()
  .then(() => {
    console.log('✅ Test user setup complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error creating test user:', error)
    process.exit(1)
  })
