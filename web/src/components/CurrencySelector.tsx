import React from 'react'
import { getSupportedCurrencies, getCurrencyInfo } from '../utils/currency'

interface CurrencySelectorProps {
  currency: string
  onCurrencyChange: (currency: string) => void
  className?: string
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({ 
  currency, 
  onCurrencyChange, 
  className = '' 
}) => {
  const currencies = getSupportedCurrencies()
  const currentCurrency = getCurrencyInfo(currency)

  return (
    <div className={`relative ${className}`}>
      <select
        value={currency}
        onChange={(e) => onCurrencyChange(e.target.value)}
        className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      >
        {currencies.map((curr) => (
          <option key={curr.code} value={curr.code}>
            {curr.flag} {curr.symbol} {curr.name}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}

export default CurrencySelector

