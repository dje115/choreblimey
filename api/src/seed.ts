import { prisma } from './db/prisma.js'

async function main() {
  console.log('🌱 Seeding ChoreBlimey demo data...')

  const family = await prisma.family.create({
    data: { nameCipher: 'Family Alpha (cipher-placeholder)', region: 'UK' }
  })

  const ellie = await prisma.child.create({ data: { familyId: family.id, nickname: 'Ellie', ageGroup: '5-8', gender: 'female' } })
  const ben   = await prisma.child.create({ data: { familyId: family.id, nickname: 'Ben', ageGroup: '12-15', gender: 'male' } })

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
      // Amazon affiliate rewards with age/gender targeting
      { 
        familyId: family.id, 
        type: 'affiliate', 
        title: 'LEGO Creator Mini Set', 
        description: 'Build amazing creations with this fun LEGO set!',
        starsRequired: 400, 
        imageUrl: 'https://via.placeholder.co/200x200', 
        amazonUrl: 'https://amazon.co.uk/dp/B08XYZ123', 
        affiliateTag: 'choreblimey-21',
        ageTag: '5-8',
        genderTag: 'both',
        category: 'toys',
        pricePence: 2500
      },
      { 
        familyId: family.id, 
        type: 'affiliate', 
        title: 'Minecraft Building Set', 
        description: 'For the creative builder in your family!',
        starsRequired: 500, 
        amazonUrl: 'https://amazon.co.uk/dp/B09ABC456', 
        affiliateTag: 'choreblimey-21',
        ageTag: '9-11',
        genderTag: 'both',
        category: 'toys',
        pricePence: 3000
      },
      { 
        familyId: family.id, 
        type: 'affiliate', 
        title: 'Harry Potter Book Set', 
        description: 'Magical adventures await!',
        starsRequired: 600, 
        amazonUrl: 'https://amazon.co.uk/dp/B10DEF789', 
        affiliateTag: 'choreblimey-21',
        ageTag: '12-15',
        genderTag: 'both',
        category: 'books',
        pricePence: 4500
      },
      { 
        familyId: family.id, 
        type: 'affiliate', 
        title: 'Barbie Fashion Set', 
        description: 'Dress up and imagine amazing adventures!',
        starsRequired: 350, 
        amazonUrl: 'https://amazon.co.uk/dp/B11GHI012', 
        affiliateTag: 'choreblimey-21',
        ageTag: '5-8',
        genderTag: 'female',
        category: 'toys',
        pricePence: 1800
      },
      { 
        familyId: family.id, 
        type: 'affiliate', 
        title: 'Action Figure Set', 
        description: 'Epic battles and adventures!',
        starsRequired: 400, 
        amazonUrl: 'https://amazon.co.uk/dp/B12JKL345', 
        affiliateTag: 'choreblimey-21',
        ageTag: '5-8',
        genderTag: 'male',
        category: 'toys',
        pricePence: 2200
      },
      { 
        familyId: family.id, 
        type: 'affiliate', 
        title: 'Zoo Day Out Tickets', 
        description: 'A fun family day at the local zoo!',
        starsRequired: 800, 
        daysOutUrl: 'https://example-zoo.co.uk/tickets', 
        affiliateTag: 'ref=choreblimey',
        ageTag: 'all',
        genderTag: 'both',
        category: 'experiences',
        pricePence: 5500
      },
      { 
        familyId: family.id, 
        type: 'affiliate', 
        title: 'Cinema Tickets', 
        description: 'Watch the latest blockbuster on the big screen!',
        starsRequired: 700, 
        daysOutUrl: 'https://example-cinema.co.uk/tickets', 
        affiliateTag: 'ref=choreblimey',
        ageTag: '12-15',
        genderTag: 'both',
        category: 'experiences',
        pricePence: 2800
      },
      // Custom rewards
      { 
        familyId: family.id, 
        type: 'custom', 
        title: 'Movie Night 🍿', 
        description: 'Choose the movie and snacks!',
        starsRequired: 300,
        category: 'allowance'
      },
      { 
        familyId: family.id, 
        type: 'custom', 
        title: 'Extra Screen Time 📱', 
        description: '30 minutes of extra device time',
        starsRequired: 200,
        category: 'privileges'
      },
      { 
        familyId: family.id, 
        type: 'custom', 
        title: 'Choose Dinner Tonight 🍕', 
        description: 'You get to pick what we have for dinner!',
        starsRequired: 150,
        category: 'privileges'
      }
    ]
  })

  console.log('✅ Seed complete. Family:', family.id)
}

main().catch((e)=>{ console.error(e); process.exit(1) }).finally(async()=>{ await prisma.$disconnect() })
