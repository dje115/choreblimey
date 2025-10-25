import React from 'react'
import { useLanguage } from '../contexts/LanguageContext'

const LanguageSelector: React.FC = () => {
  const { language, setLanguage, t } = useLanguage()

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'ro', name: 'Română', flag: '🇷🇴' },
    { code: 'uk', name: 'Українська', flag: '🇺🇦' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' }
  ]

  return (
    <div className="relative">
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
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

export default LanguageSelector
