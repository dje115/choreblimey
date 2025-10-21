// ChoreBlimey Child Theme System
// 7 selectable themes for children to personalize their experience

export interface ChildTheme {
  id: string
  name: string
  emoji: string
  description: string
  colors: {
    primary: string
    secondary: string
    accent: string
    success: string
    warning: string
    background: string
    cardBg: string
    textPrimary: string
    textSecondary: string
    border: string
  }
  style: {
    borderRadius: string
    fontFamily: string
    buttonStyle: 'rounded' | 'sharp' | 'pill'
    cardShadow: string
  }
}

export const childThemes: Record<string, ChildTheme> = {
  superhero: {
    id: 'superhero',
    name: 'Superhero',
    emoji: '🦸',
    description: 'Bold & powerful! Red, blue, and yellow comic vibes',
    colors: {
      primary: '#FF3B3B', // Bold red
      secondary: '#1E88E5', // Hero blue
      accent: '#FFC107', // Golden yellow
      success: '#4CAF50',
      warning: '#FF9800',
      background: '#FFF8E1',
      cardBg: '#FFFFFF',
      textPrimary: '#1A1A1A',
      textSecondary: '#666666',
      border: '#FFE082'
    },
    style: {
      borderRadius: '12px',
      fontFamily: '"Fredoka One", "Comic Sans MS", cursive',
      buttonStyle: 'rounded',
      cardShadow: '0 8px 16px rgba(255, 59, 59, 0.2)'
    }
  },

  unicorn: {
    id: 'unicorn',
    name: 'Unicorn',
    emoji: '🦄',
    description: 'Magical & sparkly! Pink, purple, and rainbow magic',
    colors: {
      primary: '#E91E63', // Hot pink
      secondary: '#9C27B0', // Purple
      accent: '#00BCD4', // Cyan sparkle
      success: '#8BC34A',
      warning: '#FF6F00',
      background: '#FCE4EC',
      cardBg: '#FFFFFF',
      textPrimary: '#4A148C',
      textSecondary: '#7B1FA2',
      border: '#F8BBD0'
    },
    style: {
      borderRadius: '20px',
      fontFamily: '"Baloo 2", "Fredoka One", cursive',
      buttonStyle: 'pill',
      cardShadow: '0 8px 20px rgba(233, 30, 99, 0.25)'
    }
  },

  ocean: {
    id: 'ocean',
    name: 'Ocean',
    emoji: '🌊',
    description: 'Cool & calm! Teal, aqua, and deep sea blues',
    colors: {
      primary: '#00ACC1', // Cyan
      secondary: '#26C6DA', // Light cyan
      accent: '#FFA726', // Orange coral
      success: '#66BB6A',
      warning: '#FFCA28',
      background: '#E0F7FA',
      cardBg: '#FFFFFF',
      textPrimary: '#006064',
      textSecondary: '#00838F',
      border: '#B2EBF2'
    },
    style: {
      borderRadius: '16px',
      fontFamily: '"Nunito", "Baloo 2", sans-serif',
      buttonStyle: 'rounded',
      cardShadow: '0 8px 16px rgba(0, 172, 193, 0.2)'
    }
  },

  sunset: {
    id: 'sunset',
    name: 'Sunset',
    emoji: '🌅',
    description: 'Warm & chill! Orange, pink, and golden hour vibes',
    colors: {
      primary: '#FF6F00', // Deep orange
      secondary: '#FF4081', // Pink
      accent: '#FFD54F', // Golden
      success: '#66BB6A',
      warning: '#FF8A65',
      background: '#FFF3E0',
      cardBg: '#FFFFFF',
      textPrimary: '#3E2723',
      textSecondary: '#6D4C41',
      border: '#FFE0B2'
    },
    style: {
      borderRadius: '16px',
      fontFamily: '"Poppins", "Nunito", sans-serif',
      buttonStyle: 'rounded',
      cardShadow: '0 8px 20px rgba(255, 111, 0, 0.25)'
    }
  },

  'neon-city': {
    id: 'neon-city',
    name: 'Neon City',
    emoji: '🌃',
    description: 'Cyberpunk cool! Dark theme with electric neon accents',
    colors: {
      primary: '#00E5FF', // Electric cyan
      secondary: '#E040FB', // Neon purple
      accent: '#76FF03', // Neon green
      success: '#00E676',
      warning: '#FFD600',
      background: '#1A1A2E',
      cardBg: '#16213E',
      textPrimary: '#FFFFFF',
      textSecondary: '#B0B0B0',
      border: '#0F3460'
    },
    style: {
      borderRadius: '8px',
      fontFamily: '"Inter", "Roboto", sans-serif',
      buttonStyle: 'sharp',
      cardShadow: '0 8px 24px rgba(0, 229, 255, 0.3)'
    }
  },

  galaxy: {
    id: 'galaxy',
    name: 'Galaxy',
    emoji: '🌌',
    description: 'Cosmic & mysterious! Purple, pink, and starry night',
    colors: {
      primary: '#7C4DFF', // Deep purple
      secondary: '#FF4081', // Hot pink
      accent: '#18FFFF', // Cyan glow
      success: '#69F0AE',
      warning: '#FFD740',
      background: '#1A0033',
      cardBg: '#2D1B4E',
      textPrimary: '#FFFFFF',
      textSecondary: '#D1C4E9',
      border: '#4A148C'
    },
    style: {
      borderRadius: '20px',
      fontFamily: '"Poppins", "Inter", sans-serif',
      buttonStyle: 'pill',
      cardShadow: '0 8px 32px rgba(124, 77, 255, 0.4)'
    }
  },

  'high-contrast': {
    id: 'high-contrast',
    name: 'High Contrast',
    emoji: '♿',
    description: 'Maximum readability! Bold black & white for accessibility',
    colors: {
      primary: '#000000', // Pure black
      secondary: '#FFFFFF', // Pure white
      accent: '#FFD700', // Gold for highlights
      success: '#00FF00', // Bright green
      warning: '#FF0000', // Bright red
      background: '#FFFFFF',
      cardBg: '#F5F5F5',
      textPrimary: '#000000',
      textSecondary: '#333333',
      border: '#000000'
    },
    style: {
      borderRadius: '4px',
      fontFamily: '"Arial", sans-serif',
      buttonStyle: 'sharp',
      cardShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
    }
  }
}

export const getTheme = (themeId: string): ChildTheme => {
  return childThemes[themeId] || childThemes.superhero
}

export const applyTheme = (theme: ChildTheme) => {
  const root = document.documentElement
  
  // Apply CSS variables
  root.style.setProperty('--primary', theme.colors.primary)
  root.style.setProperty('--secondary', theme.colors.secondary)
  root.style.setProperty('--accent', theme.colors.accent)
  root.style.setProperty('--success', theme.colors.success)
  root.style.setProperty('--warning', theme.colors.warning)
  root.style.setProperty('--background', theme.colors.background)
  root.style.setProperty('--card-bg', theme.colors.cardBg)
  root.style.setProperty('--text-primary', theme.colors.textPrimary)
  root.style.setProperty('--text-secondary', theme.colors.textSecondary)
  root.style.setProperty('--card-border', theme.colors.border)
  
  // Apply style variables
  root.style.setProperty('--radius-lg', theme.style.borderRadius)
  root.style.setProperty('--card-shadow', theme.style.cardShadow)
  root.style.setProperty('--font-primary', theme.style.fontFamily)
}

