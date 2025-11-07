/**
 * Profanity Filter Utility
 * Filters profanity words from chat messages using fuzzy matching
 */

// Character substitution map for obfuscation detection
const OBFUSCATION_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '0': 'o',
  '5': 's',
  '$': 's',
  '7': 't',
  '+': 't',
}

/**
 * Normalize a word by removing obfuscation characters
 */
function normalizeWord(word: string): string {
  let normalized = word.toLowerCase().trim()
  
  // Replace obfuscation characters
  for (const [char, replacement] of Object.entries(OBFUSCATION_MAP)) {
    const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    normalized = normalized.replace(new RegExp(escapedChar, 'gi'), replacement)
  }
  
  // Remove common punctuation/spaces used to bypass filters
  normalized = normalized.replace(/[^\w]/g, '')
  
  return normalized
}

/**
 * Simple exact match (case-insensitive) - used for fast checking before fuzzy match
 */
function exactMatch(word: string, profanityWord: string): boolean {
  return word.toLowerCase().trim() === profanityWord.toLowerCase().trim()
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + 1   // substitution
        )
      }
    }
  }

  return dp[m][n]
}

/**
 * Check if a word matches a profanity word using fuzzy matching
 */
function fuzzyMatch(word: string, profanityWord: string, threshold: number = 2): boolean {
  const normalizedWord = normalizeWord(word)
  const normalizedProfanity = normalizeWord(profanityWord)
  const wordLength = normalizedWord.length
  const profanityLength = normalizedProfanity.length
  
  // Exact match (after normalization)
  if (normalizedWord === normalizedProfanity) {
    return true
  }

  // Extremely short words (<=2 chars) can generate false positives (e.g. "hi" vs "shit")
  // Only flag them on exact match which we already checked above
  if (wordLength < 3 || profanityLength < 3) {
    return false
  }
  
  // Check if profanity word is contained in the word (handles words like "shittt")
  if (
    wordLength >= 3 &&
    profanityLength >= 3 &&
    (normalizedWord.includes(normalizedProfanity) || normalizedProfanity.includes(normalizedWord))
  ) {
    return true
  }
  
  // Fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(normalizedWord, normalizedProfanity)
  const maxLength = Math.max(wordLength, profanityLength)
  const similarity = 1 - distance / maxLength
  
  // Match if similarity is high enough (configurable threshold)
  // For short words (3-4 chars), require exact or 1 char difference
  // For longer words, allow 2 char difference
  if (maxLength <= 4) {
    return distance <= 1
  }
  
  return distance <= threshold
}

/**
 * Star out a word (replace with **)
 */
function starOutWord(word: string): string {
  // Always replace with just **
  return '**'
}

/**
 * Filter profanity from a message
 * @param message - The message to filter
 * @param profanityWords - Array of profanity words to check against
 * @returns Object with filtered message and flagged words
 */
export function filterProfanity(
  message: string,
  profanityWords: string[]
): { filteredMessage: string; flaggedWords: string[] } {
  if (!message || !profanityWords || profanityWords.length === 0) {
    return { filteredMessage: message, flaggedWords: [] }
  }

  const flaggedWords: string[] = []
  let filteredMessage = message
  
  // Split message into words (preserve punctuation for context)
  // Match word boundaries but keep punctuation attached
  const words = message.match(/\b\w+\b/g) || []
  
  // Check each word against profanity list
  for (const word of words) {
    for (const profanityWord of profanityWords) {
      // First try exact match (faster)
      if (exactMatch(word, profanityWord) || fuzzyMatch(word, profanityWord)) {
        // Found a match - star it out
        const starred = starOutWord(word)
        
        // Replace the word in the message (case-insensitive, word boundary)
        // Escape special regex characters in the word
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi')
        filteredMessage = filteredMessage.replace(regex, (match) => {
          // Preserve original case of first letter for replacement
          return starred
        })
        
        if (!flaggedWords.includes(profanityWord.toLowerCase())) {
          flaggedWords.push(profanityWord.toLowerCase())
        }
        
        // Break after first match for this word
        break
      }
    }
  }
  
  return {
    filteredMessage,
    flaggedWords
  }
}

/**
 * Normalize word for storage (used when adding words to database)
 */
export function normalizeWordForStorage(word: string): string {
  return word.toLowerCase().trim()
}

