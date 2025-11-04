import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const giftTemplatesData = {
  "rewardCategories": [
    {
      "category": "🎬 Time & Freedom Rewards",
      "rewards": [
        {
          "title": "Extra Half-Hour Before Bed",
          "description": "🌙 Stay up 30 minutes later — use it wisely or waste it gloriously.",
          "starsRequired": 10,
          "ageTag": "5-16"
        },
        {
          "title": "Lazy Morning Pass",
          "description": "🕶 No alarms, no worries. Sleep in while everyone else does chores.",
          "starsRequired": 12,
          "ageTag": "8-16"
        },
        {
          "title": "No Homework Night",
          "description": "📚 Homework? What homework? A free evening with zero pencils involved.",
          "starsRequired": 15,
          "ageTag": "9-16"
        },
        {
          "title": "Chore Skip Card",
          "description": "🧹 One chore vanishes. Use with a grin before someone else claims it!",
          "starsRequired": 8,
          "ageTag": "5-16"
        },
        {
          "title": "Early Finish Friday",
          "description": "🕔 End your chores 30 minutes early on Friday and start your weekend first.",
          "starsRequired": 9,
          "ageTag": "7-16"
        },
        {
          "title": "Choose the Family Outing Time",
          "description": "🗓 You decide when the next trip starts — early bird or lazy start.",
          "starsRequired": 10,
          "ageTag": "10-16"
        },
        {
          "title": "Free Reading Hour",
          "description": "📖 A quiet hour with your favourite book or comic while everyone else tidies up.",
          "starsRequired": 7,
          "ageTag": "7-14"
        },
        {
          "title": "Extended Playtime Pass",
          "description": "⚽ Another 30 minutes of outdoor fun before heading in!",
          "starsRequired": 8,
          "ageTag": "5-12"
        }
      ]
    },
    {
      "category": "🎮 Entertainment & Fun Rewards",
      "rewards": [
        {
          "title": "Movie Night Madness",
          "description": "🎟 You pick the film, snacks, and seating order. Popcorn mandatory.",
          "starsRequired": 15,
          "ageTag": "5-16"
        },
        {
          "title": "Family Game Night Takeover",
          "description": "🕹 You're the Games Master — choose games, set the rules, referee the chaos.",
          "starsRequired": 14,
          "ageTag": "6-16"
        },
        {
          "title": "Screen Time Bonus",
          "description": "💻 30 extra minutes of screen magic. Enough for one more level… or five.",
          "starsRequired": 10,
          "ageTag": "8-16"
        },
        {
          "title": "Creative Chaos Hour",
          "description": "🎨 Paint, build, or craft something weird. Mess welcomed, creativity required.",
          "starsRequired": 9,
          "ageTag": "5-14"
        },
        {
          "title": "Music Takeover",
          "description": "🎧 You DJ for the evening — volume rules apply… maybe.",
          "starsRequired": 8,
          "ageTag": "10-16"
        },
        {
          "title": "Pick the Playlist",
          "description": "🎵 Your tunes on every speaker for the day. Dance-offs encouraged!",
          "starsRequired": 6,
          "ageTag": "7-16"
        },
        {
          "title": "Mini Talent Show",
          "description": "🎤 You host the family talent show — comedy, dance, or chaos allowed!",
          "starsRequired": 11,
          "ageTag": "5-16"
        },
        {
          "title": "Puzzle & Chill Night",
          "description": "🧩 Choose a puzzle or board game and enjoy a cosy, tech-free night.",
          "starsRequired": 8,
          "ageTag": "8-16"
        }
      ]
    },
    {
      "category": "🍕 Food & Comfort Rewards",
      "rewards": [
        {
          "title": "Pick the Dinner",
          "description": "🍽 Chef's hat is yours! Pizza, pancakes, or pure chaos — your call.",
          "starsRequired": 10,
          "ageTag": "5-16"
        },
        {
          "title": "Breakfast in Bed",
          "description": "🥞 Royal treatment incoming — pancakes or cereal while you lounge.",
          "starsRequired": 11,
          "ageTag": "5-16"
        },
        {
          "title": "Kitchen DJ Pass",
          "description": "🎧 Control the tunes while everyone cooks. Air guitar encouraged.",
          "starsRequired": 7,
          "ageTag": "8-16"
        },
        {
          "title": "Dessert First Pass",
          "description": "🍨 Dessert before dinner? Just this once, because you've earned it!",
          "starsRequired": 9,
          "ageTag": "5-14"
        },
        {
          "title": "Choose the Treat Night",
          "description": "🍭 Ice cream or movie popcorn? You decide the family treat.",
          "starsRequired": 8,
          "ageTag": "5-16"
        },
        {
          "title": "Chef's Assistant",
          "description": "👩‍🍳 Cook with the grown-ups and be the official taste tester.",
          "starsRequired": 6,
          "ageTag": "5-12"
        },
        {
          "title": "Snack Builder Challenge",
          "description": "🍪 Invent a new family snack recipe — bonus points for edible results!",
          "starsRequired": 7,
          "ageTag": "6-14"
        },
        {
          "title": "Cosy Cocoa Hour",
          "description": "☕ Hot chocolate and marshmallows while wrapped in your cosiest blanket.",
          "starsRequired": 6,
          "ageTag": "5-16"
        }
      ]
    },
    {
      "category": "🏆 Power & Control Rewards",
      "rewards": [
        {
          "title": "Remote Control Ruler",
          "description": "📡 Command the remote for one whole evening. No vetoes allowed.",
          "starsRequired": 6,
          "ageTag": "5-16"
        },
        {
          "title": "Parent Swap",
          "description": "🪄 Pick one job and make the parent do it — just this once!",
          "starsRequired": 20,
          "ageTag": "7-16"
        },
        {
          "title": "Make the Rules Day",
          "description": "👑 Invent 3 rules the family must follow today. 'Call me Captain Awesome' is valid.",
          "starsRequired": 25,
          "ageTag": "8-16"
        },
        {
          "title": "Family Shout-Out Award",
          "description": "🎤 Get a dinner-table announcement: 'Chore Champion of the Week!'",
          "starsRequired": 5,
          "ageTag": "5-16"
        },
        {
          "title": "Choose the Family Activity",
          "description": "🎯 Movie, walk, picnic — whatever you pick, everyone joins in.",
          "starsRequired": 10,
          "ageTag": "5-16"
        },
        {
          "title": "Swap a Chore with a Sibling",
          "description": "🔄 Pick one task and trade it — if your sibling agrees, that is!",
          "starsRequired": 9,
          "ageTag": "7-16"
        },
        {
          "title": "One Day Boss",
          "description": "🧭 Lead the day — pick what happens (within reason).",
          "starsRequired": 18,
          "ageTag": "10-16"
        },
        {
          "title": "Family DJ Night",
          "description": "🎤 Control the playlist for dinner and party time. No skip requests!",
          "starsRequired": 7,
          "ageTag": "8-16"
        }
      ]
    },
    {
      "category": "🌳 Adventure & Shared Rewards",
      "rewards": [
        {
          "title": "Outdoor Adventure Token",
          "description": "🌳 Pick the park, trail, or beach — adventure is yours! Bonus points for finding frogs.",
          "starsRequired": 12,
          "ageTag": "5-16"
        },
        {
          "title": "Fort Building Time",
          "description": "🪵 Blanket fort? Pillow castle? Build your fortress and defend it bravely.",
          "starsRequired": 9,
          "ageTag": "5-12"
        },
        {
          "title": "Mini Shopping Trip",
          "description": "🛒 Choose one shop and go exploring — no guarantees of purchases!",
          "starsRequired": 14,
          "ageTag": "6-16"
        },
        {
          "title": "Pet Commander",
          "description": "🐾 You're in charge of walks, cuddles, and snacks today. Expect wagging tails.",
          "starsRequired": 8,
          "ageTag": "5-16"
        },
        {
          "title": "Picnic Picker",
          "description": "🧺 Choose the picnic spot and the snacks. Sunshine not guaranteed.",
          "starsRequired": 10,
          "ageTag": "5-16"
        },
        {
          "title": "Nature Detective",
          "description": "🔍 Go on a mini nature hunt — spot bugs, leaves, or birds for fun points!",
          "starsRequired": 7,
          "ageTag": "5-12"
        },
        {
          "title": "Family Walk Leader",
          "description": "🚶 You lead the route. No one argues with the map master!",
          "starsRequired": 9,
          "ageTag": "7-16"
        },
        {
          "title": "Campout Night",
          "description": "🔥 Sleep in a tent (garden or living room) — tell stories under the stars.",
          "starsRequired": 20,
          "ageTag": "6-16"
        }
      ]
    }
  ]
}

async function seedGiftTemplates() {
  try {
    console.log('🎁 Seeding admin gift templates...')
    
    let totalCreated = 0
    
    for (const categoryData of giftTemplatesData.rewardCategories) {
      const category = categoryData.category
      console.log(`\n📦 Processing category: ${category}`)
      
      for (const reward of categoryData.rewards) {
        try {
          // Check if template already exists
          const existing = await prisma.giftTemplate.findFirst({
            where: {
              title: reward.title,
              type: 'activity'
            }
          })
          
          if (existing) {
            console.log(`  ⏭️  Skipping "${reward.title}" (already exists)`)
            continue
          }
          
          // Parse ageTag into suggestedAgeRanges array
          const suggestedAgeRanges = reward.ageTag ? [reward.ageTag] : null
          
          await prisma.giftTemplate.create({
            data: {
              type: 'activity',
              title: reward.title,
              description: reward.description,
              category: category,
              suggestedAgeRanges: suggestedAgeRanges,
              suggestedGender: null, // Not specified in the data
              suggestedStars: reward.starsRequired,
              active: true,
              featured: false
            }
          })
          
          totalCreated++
          console.log(`  ✅ Created: "${reward.title}" (${reward.starsRequired} stars)`)
        } catch (error) {
          console.error(`  ❌ Failed to create "${reward.title}":`, error.message)
        }
      }
    }
    
    console.log(`\n✅ Gift template seeding complete!`)
    console.log(`📊 Created ${totalCreated} new gift templates`)
    
  } catch (error) {
    console.error('❌ Error seeding gift templates:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedGiftTemplates()

