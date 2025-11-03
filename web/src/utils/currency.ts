export interface CurrencyInfo {
  code: string
  symbol: string
  name: string
  flag: string
  decimalPlaces: number
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    flag: '🇬🇧',
    decimalPlaces: 2
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    flag: '🇪🇺',
    decimalPlaces: 2
  },
  RON: {
    code: 'RON',
    symbol: 'lei',
    name: 'Romanian Leu',
    flag: '🇷🇴',
    decimalPlaces: 2
  },
  UAH: {
    code: 'UAH',
    symbol: '₴',
    name: 'Ukrainian Hryvnia',
    flag: '🇺🇦',
    decimalPlaces: 2
  },
  CNY: {
    code: 'CNY',
    symbol: '¥',
    name: 'Chinese Yuan',
    flag: '🇨🇳',
    decimalPlaces: 2
  },
  ETB: {
    code: 'ETB',
    symbol: 'Br',
    name: 'Ethiopian Birr',
    flag: '🇪🇹',
    decimalPlaces: 2
  }
}

export function formatCurrency(amountPence: number, currency: string = 'GBP'): string {
  const currencyInfo = CURRENCIES[currency] || CURRENCIES.GBP
  const amount = amountPence / 100
  
  return `${currencyInfo.symbol}${amount.toFixed(currencyInfo.decimalPlaces)}`
}

export function getCurrencyInfo(currency: string): CurrencyInfo {
  return CURRENCIES[currency] || CURRENCIES.GBP
}

export function getSupportedCurrencies(): CurrencyInfo[] {
  return Object.values(CURRENCIES)
}












