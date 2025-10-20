import { randomBytes } from 'crypto'

export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export function generateJoinCode(): string {
  // Generate a 6-character alphanumeric code that's easy to type
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude confusing chars like 0, O, I, 1
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function generateQRData(joinCode: string, familyName: string): string {
  return JSON.stringify({
    type: 'child_join',
    code: joinCode,
    family: familyName,
    timestamp: Date.now()
  })
}

export function parseQRData(qrData: string): { type: string; code: string; family: string; timestamp: number } | null {
  try {
    const parsed = JSON.parse(qrData)
    if (parsed.type === 'child_join' && parsed.code && parsed.family) {
      return parsed
    }
  } catch (error) {
    // Invalid JSON - might be old format or corrupted
  }
  return null
}
