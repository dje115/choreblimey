import { prisma } from './db/prisma.ts'

async function main() {
  console.log('🌱 Seeding ChoreBlimey demo data...')

  const family = await prisma.family.create({
    data: { nameCipher: 'Family Alpha (cipher-placeholder)', region: 'UK' }
  })

  const ellie = await prisma.child.create({ data: { familyId: family.id, nickname: 'Ellie', ageGroup: 'kid_5_8' } })
  const ben   = await prisma.child.create({ data: { familyId: family.id, nickname: 'Ben', ageGroup: 'teen_12_15' } })

  const choresSeed = [
    ['Make bed', 30], ['Brush teeth AM/PM', 20], ['Tidy bedroom', 50],
    ['Set the table', 30], ['Clear the table', 30], ['Wash dishes', 50],
    ['Load/unload dishwasher', 50], ['Feed pets', 30], ['Water plants', 30],
    ['Take out rubbish', 50], ['Recycling sort', 40], ['Sweep/vacuum room', 60],
    ['Fold laundry', 50], ['Put laundry away', 40], ['Wipe kitchen surfaces', 40],
    ['Clean bathroom sink', 50], ['Homework (20 min)', 60], ['Read book (15 min)', 40],
    ['Practice instrument (15 min)', 60], ['Help cook dinner', 70]
  ] as const

  const chores = []
  for (const [title, p] of choresSeed) {
    const c = await prisma.chore.create({
      data: {
        familyId: family.id, title, baseRewardPence: p,
        frequency: 'daily', proof: 'none',
        minBidPence: Math.floor(p * 0.5), maxBidPence: Math.floor(p * 1.5)
      }
    })
    chores.push(c)
  }

  for (let i = 0; i < chores.length; i++) {
    await prisma.assignment.create({
      data: {
        familyId: family.id, choreId: chores[i].id,
        childId: i % 2 === 0 ? ellie.id : ben.id,
        biddingEnabled: i % 3 === 0
      }
    })
  }

  await prisma.bonusRule.create({
    data: { familyId: family.id, ruleJson: { streakBonus5DaysPercent: 10, streakBonus7DaysPercent: 20, teamUpBonusPercent: 20, teamUpStars: 10 } }
  })
  await prisma.penaltyRule.create({
    data: { familyId: family.id, ruleJson: { skipDaysThreshold: 7, penaltyPercent: 25 } }
  })

  await prisma.reward.createMany({
    data: [
      { familyId: family.id, type: 'affiliate', title: 'LEGO Creator Mini Set', starsRequired: 400, imageUrl: 'https://via.placeholder.co/200x200', amazonUrl: 'https://amazon.example/lego', affiliateTag: 'choreblimey-21' },
      { familyId: family.id, type: 'custom', title: 'Movie Night 🍿', starsRequired: 300 }
    ]
  })

  console.log('✅ Seed complete. Family:', family.id)
}

main().catch((e)=>{ console.error(e); process.exit(1) }).finally(async()=>{ await prisma.$disconnect() })
