// ChoreBlimey! Chore Template Library
// Suggested chores with typical frequencies and relative values

export interface ChoreTemplate {
  id: string
  title: string
  description: string
  category: 'personal' | 'kitchen' | 'household' | 'outdoor' | 'homework' | 'pets'
  frequency: 'daily' | 'weekly' | 'once'
  frequencyPerWeek?: number // For tasks done 2-3x per week
  relativeValue: number // 1-5 (used to calculate actual pence based on budget)
  ageGroup?: '5-8' | '9-11' | '12-15' // Some chores are age-appropriate
  icon: string
}

export const choreTemplates: ChoreTemplate[] = [
  // Personal Care & Room (Daily/Weekly)
  {
    id: 'make-bed',
    title: 'Make Your Bed',
    description: 'Straighten sheets, arrange pillows, and make it look neat',
    category: 'personal',
    frequency: 'daily',
    relativeValue: 1,
    icon: '🛏️'
  },
  {
    id: 'brush-teeth',
    title: 'Brush Teeth (AM & PM)',
    description: 'Brush teeth morning and night',
    category: 'personal',
    frequency: 'daily',
    relativeValue: 1,
    ageGroup: '5-8',
    icon: '🪥'
  },
  {
    id: 'tidy-room',
    title: 'Tidy Your Room',
    description: 'Pick up toys, organize desk, vacuum if needed',
    category: 'personal',
    frequency: 'weekly',
    relativeValue: 3,
    icon: '🧹'
  },
  {
    id: 'clean-room-deep',
    title: 'Deep Clean Your Room',
    description: 'Dust, vacuum, organize closet, wash windows',
    category: 'personal',
    frequency: 'weekly',
    relativeValue: 4,
    ageGroup: '12-15',
    icon: '✨'
  },
  {
    id: 'put-laundry-away',
    title: 'Put Away Your Laundry',
    description: 'Fold and put away clean clothes in drawers',
    category: 'personal',
    frequency: 'weekly',
    frequencyPerWeek: 2,
    relativeValue: 2,
    icon: '👕'
  },

  // Kitchen & Dining
  {
    id: 'set-table',
    title: 'Set the Table',
    description: 'Put out plates, cutlery, and glasses for dinner',
    category: 'kitchen',
    frequency: 'daily',
    relativeValue: 1,
    icon: '🍽️'
  },
  {
    id: 'clear-table',
    title: 'Clear the Table',
    description: 'Take dishes to kitchen after meals',
    category: 'kitchen',
    frequency: 'daily',
    relativeValue: 1,
    icon: '🧼'
  },
  {
    id: 'wash-dishes',
    title: 'Wash the Dishes',
    description: 'Wash, rinse, and dry dishes by hand',
    category: 'kitchen',
    frequency: 'daily',
    relativeValue: 3,
    ageGroup: '9-11',
    icon: '🧽'
  },
  {
    id: 'load-dishwasher',
    title: 'Load/Empty Dishwasher',
    description: 'Load dirty dishes or put away clean ones',
    category: 'kitchen',
    frequency: 'daily',
    relativeValue: 2,
    icon: '🍴'
  },
  {
    id: 'wipe-counters',
    title: 'Wipe Kitchen Surfaces',
    description: 'Clean counters, table, and stovetop',
    category: 'kitchen',
    frequency: 'daily',
    relativeValue: 2,
    icon: '🧴'
  },
  {
    id: 'help-cook',
    title: 'Help Cook Dinner',
    description: 'Assist with meal prep, stirring, or chopping',
    category: 'kitchen',
    frequency: 'weekly',
    frequencyPerWeek: 3,
    relativeValue: 4,
    ageGroup: '12-15',
    icon: '👨‍🍳'
  },

  // Household Chores
  {
    id: 'take-out-rubbish',
    title: 'Take Out the Rubbish',
    description: 'Empty bins and take bags to outside bin',
    category: 'household',
    frequency: 'weekly',
    frequencyPerWeek: 2,
    relativeValue: 2,
    icon: '🗑️'
  },
  {
    id: 'recycling',
    title: 'Sort Recycling',
    description: 'Separate paper, plastic, and glass',
    category: 'household',
    frequency: 'weekly',
    relativeValue: 2,
    icon: '♻️'
  },
  {
    id: 'vacuum',
    title: 'Vacuum Living Areas',
    description: 'Vacuum carpets and rugs in common areas',
    category: 'household',
    frequency: 'weekly',
    relativeValue: 3,
    ageGroup: '9-11',
    icon: '🧹'
  },
  {
    id: 'dust',
    title: 'Dust Furniture',
    description: 'Wipe down surfaces, shelves, and picture frames',
    category: 'household',
    frequency: 'weekly',
    relativeValue: 2,
    icon: '🧽'
  },
  {
    id: 'clean-bathroom',
    title: 'Clean Bathroom',
    description: 'Wipe sink, mirror, and toilet',
    category: 'household',
    frequency: 'weekly',
    relativeValue: 4,
    ageGroup: '12-15',
    icon: '🚿'
  },
  {
    id: 'fold-laundry',
    title: 'Fold Family Laundry',
    description: 'Fold clean towels and clothes',
    category: 'household',
    frequency: 'weekly',
    frequencyPerWeek: 2,
    relativeValue: 3,
    ageGroup: '9-11',
    icon: '🧺'
  },

  // Outdoor & Garden
  {
    id: 'water-plants',
    title: 'Water Plants',
    description: 'Water indoor or outdoor plants',
    category: 'outdoor',
    frequency: 'weekly',
    frequencyPerWeek: 3,
    relativeValue: 1,
    icon: '🌱'
  },
  {
    id: 'mow-lawn',
    title: 'Mow the Lawn',
    description: 'Cut grass with supervision',
    category: 'outdoor',
    frequency: 'weekly',
    relativeValue: 5,
    ageGroup: '12-15',
    icon: '🌿'
  },
  {
    id: 'rake-leaves',
    title: 'Rake Leaves',
    description: 'Gather fallen leaves in garden',
    category: 'outdoor',
    frequency: 'once',
    relativeValue: 4,
    ageGroup: '9-11',
    icon: '🍂'
  },
  {
    id: 'wash-car',
    title: 'Wash the Car',
    description: 'Soap, rinse, and dry the family car',
    category: 'outdoor',
    frequency: 'once',
    relativeValue: 5,
    ageGroup: '12-15',
    icon: '🚗'
  },

  // Homework & Learning
  {
    id: 'homework',
    title: 'Complete Homework',
    description: '30 minutes of focused homework time',
    category: 'homework',
    frequency: 'daily',
    frequencyPerWeek: 5, // Weekdays only
    relativeValue: 3,
    icon: '📚'
  },
  {
    id: 'reading',
    title: 'Read for 20 Minutes',
    description: 'Independent reading time',
    category: 'homework',
    frequency: 'daily',
    relativeValue: 2,
    icon: '📖'
  },
  {
    id: 'practice-instrument',
    title: 'Practice Instrument',
    description: '20 minutes of music practice',
    category: 'homework',
    frequency: 'daily',
    frequencyPerWeek: 5,
    relativeValue: 3,
    icon: '🎵'
  },

  // Pet Care
  {
    id: 'feed-pets',
    title: 'Feed Pets',
    description: 'Give pets their food and fresh water',
    category: 'pets',
    frequency: 'daily',
    relativeValue: 2,
    icon: '🐕'
  },
  {
    id: 'walk-dog',
    title: 'Walk the Dog',
    description: '15-minute walk around the block',
    category: 'pets',
    frequency: 'daily',
    relativeValue: 3,
    ageGroup: '9-11',
    icon: '🦮'
  },
  {
    id: 'clean-litter',
    title: 'Clean Litter Box',
    description: 'Scoop cat litter tray',
    category: 'pets',
    frequency: 'daily',
    relativeValue: 2,
    ageGroup: '9-11',
    icon: '🐈'
  }
]

export const categoryLabels: Record<string, { label: string; icon: string }> = {
  personal: { label: 'Personal Care & Room', icon: '🛏️' },
  kitchen: { label: 'Kitchen & Dining', icon: '🍽️' },
  household: { label: 'Household Chores', icon: '🏠' },
  outdoor: { label: 'Outdoor & Garden', icon: '🌳' },
  homework: { label: 'Homework & Learning', icon: '📚' },
  pets: { label: 'Pet Care', icon: '🐾' }
}

// Calculate suggested reward based on weekly budget and relative value
export function calculateSuggestedReward(
  template: ChoreTemplate,
  weeklyBudgetPence: number
): number {
  // Total relative value of all chores if every task was done
  const totalRelativeValue = choreTemplates.reduce((sum, t) => {
    const timesPerWeek = t.frequency === 'daily' ? (t.frequencyPerWeek || 7) : 
                         t.frequency === 'weekly' ? (t.frequencyPerWeek || 1) : 0.25
    return sum + (t.relativeValue * timesPerWeek)
  }, 0)

  // Calculate times per week for this chore
  const timesPerWeek = template.frequency === 'daily' ? (template.frequencyPerWeek || 7) :
                       template.frequency === 'weekly' ? (template.frequencyPerWeek || 1) : 0.25

  // This chore's share of the weekly budget
  const weeklyValueForThisChore = (template.relativeValue * timesPerWeek / totalRelativeValue) * weeklyBudgetPence

  // Per-completion value
  const perCompletionValue = weeklyValueForThisChore / timesPerWeek

  // Round to nearest 5p
  return Math.max(5, Math.round(perCompletionValue / 5) * 5)
}

