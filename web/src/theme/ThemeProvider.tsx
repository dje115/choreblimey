import React, { createContext, useContext, useEffect, ReactNode } from 'react'
import tokens from './tokens.json'

export type Role = 'parent_admin' | 'parent_viewer' | 'relative_contributor' | 'child_player'
export type Age = 'kid_5_8' | 'tween_9_11' | 'teen_12_15' | null

export function themeKey(role: Role, age: Age): keyof typeof tokens {
  if (role.startsWith('parent')) return 'parent'
  if (role === 'relative_contributor') return 'relative'
  if (role === 'child_player') {
    if (age === 'teen_12_15') return 'child_teen'
    if (age === 'tween_9_11') return 'child_tween'
    return 'child_kid'
  }
  return 'parent' // fallback
}

interface ThemeContextType {
  currentTheme: keyof typeof tokens
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
  role?: Role
  age?: Age
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  role = 'parent_admin', 
  age = null 
}) => {
  const currentTheme = themeKey(role, age)
  const themeData = tokens[currentTheme]

  useEffect(() => {
    const root = document.documentElement
    
    root.style.setProperty('--background', themeData.bg)
    root.style.setProperty('--background-secondary', themeData.secondary_bg || themeData.bg)
    root.style.setProperty('--foreground', themeData.text)
    root.style.setProperty('--foreground-secondary', themeData.secondary_text || themeData.text)
    root.style.setProperty('--primary', themeData.accent)
    root.style.setProperty('--primary-contrast', '#FFFFFF')
    root.style.setProperty('--secondary', themeData.accent_secondary || themeData.accent)
    root.style.setProperty('--success', '#00C897')
    root.style.setProperty('--warning', '#FEC93D')
    root.style.setProperty('--danger', '#E74C3C')
    root.style.setProperty('--card-bg', themeData.card || '#FFFFFF')
    root.style.setProperty('--card-border', themeData.card_border || 'rgba(0,0,0,0.05)')
    root.style.setProperty('--text-primary', themeData.text)
    root.style.setProperty('--text-secondary', themeData.secondary_text || '#666666')
    root.style.setProperty('--bonus-star', '#FFD700')
    root.style.setProperty('--streak-glow', 'radial-gradient(circle, rgba(255,215,0,0.6) 0%, rgba(255,138,0,0.35) 50%, rgba(255,138,0,0) 80%)')
    
    const borderRadius = themeData.animation === 'high' ? '24px' : '20px'
    root.style.setProperty('--radius-xl', borderRadius)
    root.style.setProperty('--radius-lg', '18px')
    root.style.setProperty('--radius-md', '14px')
    root.style.setProperty('--card-shadow', '0 18px 45px rgba(0,0,0,0.08)')
    root.style.setProperty('--shadow-soft', '0 8px 24px rgba(0,0,0,0.06)')
    root.style.setProperty('--shadow-strong', '0 18px 36px rgba(0,0,0,0.12)')
    
    if (themeData.animation === 'low') {
      root.classList.add('cb-reduced-motion')
    } else {
      root.classList.remove('cb-reduced-motion')
    }
  }, [currentTheme, themeData])

  const value: ThemeContextType = {
    currentTheme
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
